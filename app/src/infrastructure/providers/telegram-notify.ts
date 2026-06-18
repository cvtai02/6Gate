import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, groupNotificationChannels, groupUploadQueue, postJobs } from "@/infrastructure/db/schema";
import { telegramRequest } from "@/modules/accounts/usecases/shared/telegram-helpers";
import { decryptValue } from "@/core/security/crypto";
import { env } from "@/infrastructure/config/env";
import { PublishStatus } from "@/core/enums";

export async function notifyTelegramIfConfigured(uploadBatchId: string) {
  const db = getDb();

  const batchJobs = await db.select().from(postJobs).where(eq(postJobs.uploadBatchId, uploadBatchId));
  if (batchJobs.length === 0) return;

  const allDone = batchJobs.every(
    (j) => j.status === PublishStatus.Published || j.status === PublishStatus.Failed,
  );
  if (!allDone) return;

  const groupId = batchJobs[0].groupId;
  if (!groupId) return;

  const published = batchJobs.filter((j) => j.status === PublishStatus.Published);
  const failed = batchJobs.filter((j) => j.status === PublishStatus.Failed);

  const title = batchJobs[0].title || "Untitled";
  const lines: string[] = [];

  if (failed.length === 0) {
    lines.push(`✅ <b>${escapeHtml(title)}</b>`);
    lines.push(`Published to ${published.length} destination${published.length > 1 ? "s" : ""}`);
  } else if (published.length === 0) {
    lines.push(`❌ <b>${escapeHtml(title)}</b>`);
    lines.push(`Failed on all ${failed.length} destination${failed.length > 1 ? "s" : ""}`);
  } else {
    lines.push(`⚠️ <b>${escapeHtml(title)}</b>`);
    lines.push(`${published.length} published, ${failed.length} failed`);
  }

  for (const job of published) {
    const url = job.providerPostUrl;
    const platform = job.platform ?? "unknown";
    lines.push(url ? `  • ${platform}: <a href="${escapeHtml(url)}">link</a>` : `  • ${platform}: published`);
  }
  for (const job of failed) {
    const platform = job.platform ?? "unknown";
    const err = job.errorMessage ? `: ${escapeHtml(job.errorMessage.slice(0, 100))}` : "";
    lines.push(`  • ${platform}: failed${err}`);
  }

  const text = lines.join("\n");

  const queueItem = await db
    .select({ sourceChatId: groupUploadQueue.sourceChatId, sourceAccountId: groupUploadQueue.sourceAccountId })
    .from(groupUploadQueue)
    .where(eq(groupUploadQueue.uploadBatchId, uploadBatchId))
    .then((r) => r[0]);

  if (queueItem?.sourceChatId && queueItem?.sourceAccountId) {
    const account = await db.select().from(accounts).where(eq(accounts.id, queueItem.sourceAccountId)).then((r) => r[0]);
    if (account?.accessToken) {
      const botToken = decryptValue(account.accessToken, env.encryptionKey);
      try {
        await telegramRequest(botToken, "sendMessage", {
          chat_id: queueItem.sourceChatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
      } catch {}
    }
    return;
  }

  const channels = await db.select().from(groupNotificationChannels).where(eq(groupNotificationChannels.groupId, groupId));
  for (const channel of channels) {
    const account = await db.select().from(accounts).where(eq(accounts.id, channel.accountId)).then((r) => r[0]);
    if (!account?.accessToken) continue;

    const botToken = decryptValue(account.accessToken, env.encryptionKey);
    try {
      await telegramRequest(botToken, "sendMessage", {
        chat_id: channel.chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    } catch {}
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
