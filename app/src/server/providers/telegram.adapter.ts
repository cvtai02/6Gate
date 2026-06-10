import path from "path";
import { eq } from "drizzle-orm";
import type { PublishVideoInput, PublishVideoResult, SocialProviderAdapter } from "./types";
import { getDb } from "@/server/db";
import { accounts, destinations } from "@/server/db/schema";
import { readVideoFile } from "./adapter-utils";
import { appendLog } from "@/server/jobs/log-service";

type TelegramSendVideoResponse = {
  ok: boolean;
  description?: string;
  error_code?: number;
  parameters?: {
    retry_after?: number;
  };
  result?: {
    message_id?: number;
    chat?: {
      id?: number | string;
      username?: string;
      title?: string;
    };
  };
};

function normalizePublicUsername(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const username = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  return /^[a-zA-Z0-9_]{5,32}$/.test(username) ? username : null;
}

export class TelegramAdapter implements SocialProviderAdapter {
  id = "telegram";
  name = "Telegram";

  async getAuthUrl(): Promise<string> {
    throw new Error("Telegram uses bot-token setup, not OAuth. Add a Telegram account with a bot token and chat ID.");
  }

  async handleOAuthCallback(): Promise<void> {
    throw new Error("Telegram uses bot-token setup, not OAuth. Add a Telegram account with a bot token and chat ID.");
  }

  async refreshToken(): Promise<void> {
    return;
  }

  async publishVideo(input: PublishVideoInput): Promise<PublishVideoResult> {
    if (!input.destinationId) throw new Error("Telegram destination is required");

    const db = getDb();
    const account = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).then((r) => r[0]);
    if (!account) throw new Error(`Account ${input.accountId} not found`);
    if (!account.accessToken) throw new Error("Telegram bot token is missing from the account");

    const destination = await db
      .select()
      .from(destinations)
      .where(eq(destinations.id, input.destinationId))
      .then((r) => r[0]);
    if (!destination) throw new Error(`Destination ${input.destinationId} not found`);
    if (!destination.externalId) throw new Error("Telegram destination chat ID is missing");

    const { buffer, mime } = readVideoFile(input.videoPath);
    const caption = input.caption || input.title || "";
    const form = new FormData();
    form.set("chat_id", destination.externalId);
    if (caption) form.set("caption", caption.slice(0, 1024));
    form.set("supports_streaming", "true");
    form.set("video", new Blob([buffer], { type: mime }), path.basename(input.videoPath));

    if (input.jobId) {
      await appendLog(input.jobId, "info", `Sending video to Telegram chat ${destination.name}`).catch(() => undefined);
    }

    const response = await fetch(`https://api.telegram.org/bot${account.accessToken}/sendVideo`, {
      method: "POST",
      body: form,
    });
    const data = await response.json().catch(() => null) as TelegramSendVideoResponse | null;

    if (!response.ok || !data?.ok) {
      const retry = data?.parameters?.retry_after ? ` Retry after ${data.parameters.retry_after}s.` : "";
      const description = data?.description ?? `HTTP ${response.status}`;
      throw new Error(`Telegram sendVideo failed: ${description}.${retry}`);
    }

    const messageId = data.result?.message_id;
    if (!messageId) throw new Error("Telegram sendVideo succeeded without a message_id");

    const publicUsername =
      normalizePublicUsername(data.result?.chat?.username) ??
      normalizePublicUsername(destination.externalId) ??
      normalizePublicUsername(destination.name);

    return {
      providerPostId: String(messageId),
      url: publicUsername ? `https://t.me/${publicUsername}/${messageId}` : undefined,
    };
  }
}
