import { Injectable } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, groupNotificationChannels, groupUploadQueue, groupUploadSettings, groups } from "@/infrastructure/db/schema";
import { downloadTelegramFile, telegramRequest } from "@/modules/accounts/usecases/shared/telegram-helpers";
import { decryptValue } from "@/core/security/crypto";
import { env } from "@/infrastructure/config/env";
import { EnqueueGroupUploadUseCase } from "@/modules/groups/usecases/commands/enqueue-group-upload.usecase";
import { QUEUE_STATUS_PENDING, localDateKey, localTimeKey, parseLastTriggeredSlot, parseUploadTimes } from "@/modules/groups/usecases/shared/group-helpers";

type TelegramMessage = {
  message_id: number;
  chat: { id: number; title?: string; username?: string };
  from?: { first_name?: string; username?: string; is_bot?: boolean };
  text?: string;
  caption?: string;
  video?: { file_id: string; file_name?: string };
  document?: { file_id: string; file_name?: string; mime_type?: string };
};

type TelegramWebhookUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function estimatePublishTime(position: number, uploadTimes: string[], lastTriggeredDate: string | null): Date | null {
  if (uploadTimes.length === 0 || position <= 0) return null;
  const sorted = [...uploadTimes].sort();
  const today = localDateKey();
  const now = localTimeKey();
  const lastSlot = parseLastTriggeredSlot(lastTriggeredDate);

  let remaining = position;
  let dayOffset = 0;

  while (remaining > 0) {
    for (const slot of sorted) {
      const isToday = dayOffset === 0;
      if (isToday && slot <= now) continue;
      if (isToday && lastSlot?.date === today && slot <= lastSlot.slot) continue;
      remaining--;
      if (remaining === 0) {
        const [h, m] = slot.split(":").map(Number);
        const d = new Date();
        d.setDate(d.getDate() + dayOffset);
        d.setHours(h, m, 0, 0);
        return d;
      }
    }
    dayOffset++;
  }
  return null;
}

function formatDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${hh}:${mm} ${dd}/${mo}`;
}

@Injectable()
export class HandleTelegramWebhookUseCase {
  constructor(private readonly enqueue: EnqueueGroupUploadUseCase) {}

  async execute(accountId: string, update: TelegramWebhookUpdate) {
    const message = update.message;
    if (!message) return;

    const text = message.caption ?? message.text ?? "";
    if (!text.startsWith("/queue")) return;

    const db = getDb();
    const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).then((r) => r[0]);
    if (!account?.accessToken) return;
    const botToken = decryptValue(account.accessToken, env.encryptionKey);

    const video = message.video ?? this.extractVideoDocument(message.document);
    const sevenRouterPath = text.match(/@7router:\s*(.+)/i)?.[1]?.trim() || undefined;
    const title = text.match(/@title:\s*(.+)/i)?.[1]?.trim() || undefined;
    const caption = text.match(/@caption:\s*(.+)/i)?.[1]?.trim() || undefined;

    const missing: string[] = [];
    if (!video && !sevenRouterPath) missing.push("video or @7router:");
    if (!title) missing.push("@title:");
    if (!caption) missing.push("@caption:");

    if (missing.length > 0) {
      await this.reply(
        botToken,
        message.chat.id,
        `⚠️ /queue requires: ${missing.join(", ")}\n\nFormat:\n/queue\n@title: video title\n@caption: description #tags\n@7router: path/to/video.mp4 (or attach video)`,
      );
      return;
    }

    const numericChatId = String(message.chat.id);
    const allChannels = await db
      .select()
      .from(groupNotificationChannels)
      .where(eq(groupNotificationChannels.accountId, accountId));

    const channels = allChannels.filter(
      (ch) => ch.chatId === numericChatId || (message.chat.username && ch.chatId === `@${message.chat.username}`),
    );
    if (channels.length === 0) return;

    const videoPath = video
      ? await downloadTelegramFile(botToken, video.file_id)
      : sevenRouterPath!;

    for (const channel of channels) {
      await this.enqueue.execute(channel.groupId, {
        videoUrl: videoPath,
        title: title!,
        caption: caption!,
        sourceChatId: String(message.chat.id),
        sourceAccountId: accountId,
      });

      const pendingCount = await db
        .select()
        .from(groupUploadQueue)
        .where(and(eq(groupUploadQueue.groupId, channel.groupId), eq(groupUploadQueue.status, QUEUE_STATUS_PENDING)))
        .then((r) => r.length);

      const group = await db.select().from(groups).where(eq(groups.id, channel.groupId)).then((r) => r[0]);
      const settings = await db.select().from(groupUploadSettings).where(eq(groupUploadSettings.groupId, channel.groupId)).then((r) => r[0]);
      const uploadTimes = settings ? parseUploadTimes(settings.uploadTimeInDay).sort() : [];

      const publishAt = estimatePublishTime(pendingCount, uploadTimes, settings?.lastTriggeredDate ?? null);
      const lines: string[] = [];
      lines.push("Queued.");
      lines.push(`<b>${escapeHtml(title!)}</b>`);
      if (publishAt) lines.push(`published at ${formatDateTime(publishAt)}`);
      lines.push(`<a href="https://6gate.minfect.com/schedule">view schedule</a>`);

      await this.reply(botToken, message.chat.id, lines.join("\n"));
    }
  }

  private extractVideoDocument(doc?: { file_id: string; file_name?: string; mime_type?: string }) {
    if (!doc) return undefined;
    if (doc.mime_type?.startsWith("video/")) return { file_id: doc.file_id, file_name: doc.file_name };
    return undefined;
  }

  private async reply(botToken: string, chatId: number, text: string) {
    try {
      await telegramRequest(botToken, "sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    } catch {}
  }
}
