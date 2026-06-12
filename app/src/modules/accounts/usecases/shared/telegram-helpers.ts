import { NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/infrastructure/db";
import { accounts, groupDestinations, providers, destinations } from "@/infrastructure/db/schema";
import { DestinationType, ProviderType } from "@/core/enums";

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

export type TelegramBotInfo = {
  id: number;
  first_name: string;
  username?: string;
};

export type TelegramChatInfo = {
  id: number | string;
  type?: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: { chat?: TelegramChatInfo };
  edited_message?: { chat?: TelegramChatInfo };
  channel_post?: { chat?: TelegramChatInfo };
  edited_channel_post?: { chat?: TelegramChatInfo };
  my_chat_member?: { chat?: TelegramChatInfo };
  chat_member?: { chat?: TelegramChatInfo };
  callback_query?: { message?: { chat?: TelegramChatInfo } };
};

export async function telegramRequest<T>(
  botToken: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : "{}",
  });
  const data = await response.json().catch(() => null) as TelegramApiResponse<T> | null;
  if (!response.ok || !data?.ok || data.result === undefined) {
    throw new Error(`Telegram ${method} failed: ${data?.description ?? `HTTP ${response.status}`}`);
  }
  return data.result;
}

export function extractTelegramChats(updates: TelegramUpdate[]) {
  const map = new Map<string, TelegramChatInfo>();
  for (const update of updates) {
    const chats = [
      update.message?.chat,
      update.edited_message?.chat,
      update.channel_post?.chat,
      update.edited_channel_post?.chat,
      update.my_chat_member?.chat,
      update.chat_member?.chat,
      update.callback_query?.message?.chat,
    ].filter(Boolean) as TelegramChatInfo[];
    for (const chat of chats) {
      if (chat.id !== undefined && chat.id !== null) map.set(String(chat.id), chat);
    }
  }
  return [...map.values()];
}

export async function refreshTelegramChat(botToken: string, chat: TelegramChatInfo) {
  return telegramRequest<TelegramChatInfo>(botToken, "getChat", { chat_id: chat.id }).catch(() => chat);
}

export async function getTelegramAccountOrThrow(accountId: string) {
  const db = getDb();
  const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).then((r) => r[0]);
  if (!account) throw new NotFoundException("Account not found");
  const provider = await db.select().from(providers).where(eq(providers.id, account.providerId)).then((r) => r[0]);
  if (!provider || provider.type !== ProviderType.telegram) throw new Error("Account is not a Telegram bot account");
  if (!account.accessToken) throw new Error("Telegram bot token is missing from the account");
  return account;
}

export async function upsertTelegramChatDestination(accountId: string, chat: TelegramChatInfo, preferredName?: string) {
  const db = getDb();
  const chatId = String(chat.id);
  const externalId = chat.username ? `@${chat.username}` : chatId;
  const personName = [chat.first_name, chat.last_name].filter(Boolean).join(" ").trim();
  const name = preferredName?.trim() || chat.title || personName || (chat.username ? `@${chat.username}` : "") || externalId;
  const existingRows = await db
    .select()
    .from(destinations)
    .where(eq(destinations.socialAccountId, accountId))
    ;
  const matches = existingRows.filter((row) => row.externalId === externalId || row.externalId === chatId || (chat.username && row.externalId === `@${chat.username}`));
  const existing = matches[0];

  if (existing) {
    await db
      .update(destinations)
      .set({
        name,
        type: DestinationType.TelegramChat,
        externalId,
      })
      .where(eq(destinations.id, existing.id));
    for (const duplicate of matches.slice(1)) {
      await db
        .update(groupDestinations)
        .set({ destinationId: existing.id })
        .where(eq(groupDestinations.destinationId, duplicate.id));
      await db.delete(destinations).where(eq(destinations.id, duplicate.id));
    }
    return { created: false, destination: { ...existing, name, type: DestinationType.TelegramChat, externalId } };
  }

  const destination = {
    id: `dest_${nanoid(8)}`,
    socialAccountId: accountId,
    name,
    type: DestinationType.TelegramChat,
    externalId,
    accessToken: null,
    avatarUrl: null,
    createdAt: new Date().toISOString(),
  };
  await db.insert(destinations).values(destination);
  return { created: true, destination };
}
