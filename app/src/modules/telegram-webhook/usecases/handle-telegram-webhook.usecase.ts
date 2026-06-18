import { Injectable } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, groupNotificationChannels, groupUploadQueue } from "@/infrastructure/db/schema";
import { downloadTelegramFile, telegramRequest } from "@/modules/accounts/usecases/shared/telegram-helpers";
import { decryptValue } from "@/core/security/crypto";
import { env } from "@/infrastructure/config/env";
import { EnqueueGroupUploadUseCase } from "@/modules/groups/usecases/commands/enqueue-group-upload.usecase";
import { QUEUE_STATUS_PENDING } from "@/modules/groups/usecases/shared/group-helpers";

type TelegramMessage = {
  message_id: number;
  chat: { id: number; title?: string };
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
    const title = text.match(/@title:\s*(.+)/i)?.[1]?.trim() || undefined;
    const caption = text.match(/@caption:\s*(.+)/i)?.[1]?.trim() || undefined;

    const missing: string[] = [];
    if (!video) missing.push("video");
    if (!title) missing.push("@title:");
    if (!caption) missing.push("@caption:");

    if (missing.length > 0) {
      await this.reply(
        botToken,
        message.chat.id,
        `⚠️ /queue requires: ${missing.join(", ")}\n\nFormat:\n/queue\n@title: video title\n@caption: description #tags`,
      );
      return;
    }

    const chatId = String(message.chat.id);
    const channels = await db
      .select()
      .from(groupNotificationChannels)
      .where(and(eq(groupNotificationChannels.chatId, chatId), eq(groupNotificationChannels.accountId, accountId)));

    if (channels.length === 0) return;

    const localPath = await downloadTelegramFile(botToken, video!.file_id);

    for (const channel of channels) {
      await this.enqueue.execute(channel.groupId, {
        videoUrl: localPath,
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

      await this.reply(
        botToken,
        message.chat.id,
        `📥 <b>${escapeHtml(title!)}</b> queued (#${pendingCount} in queue)`,
      );
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
