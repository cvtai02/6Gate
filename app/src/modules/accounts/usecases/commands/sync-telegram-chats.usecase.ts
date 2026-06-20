import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { destinations } from "@/infrastructure/db/schema";
import { DestinationType } from "@/core/enums";
import {
  extractTelegramChats,
  getTelegramAccountOrThrow,
  refreshTelegramChat,
  telegramRequest,
  TelegramUpdate,
  upsertTelegramChatDestination,
} from "../shared/telegram-helpers";

@Injectable()
export class SyncTelegramChatsUseCase {
  async execute(accountId: string) {
    const db = getDb();
    const account = await getTelegramAccountOrThrow(accountId);

    const candidateChats = new Map<string, Awaited<ReturnType<typeof refreshTelegramChat>>>();

    // Try getUpdates — this fails when a webhook is active, which is normal
    try {
      const updates = await telegramRequest<TelegramUpdate[]>(account.accessToken!, "getUpdates", {
        limit: 100,
        allowed_updates: ["message", "channel_post", "edited_message", "edited_channel_post", "my_chat_member", "chat_member", "callback_query"],
      });
      const discoveredChats = extractTelegramChats(updates);
      for (const chat of discoveredChats) {
        const refreshed = await refreshTelegramChat(account.accessToken!, chat);
        candidateChats.set(String(refreshed.id), refreshed);
      }
    } catch {
      // Webhook is active — getUpdates is unavailable, proceed with existing destinations only
    }

    const existingDestinations = await db
      .select()
      .from(destinations)
      .where(eq(destinations.socialAccountId, accountId))
      ;
    for (const destination of existingDestinations) {
      if (destination.type !== DestinationType.TelegramChat || !destination.externalId) continue;
      const refreshed = await refreshTelegramChat(account.accessToken!, { id: destination.externalId }).catch(() => null);
      if (refreshed) candidateChats.set(String(refreshed.id), refreshed);
    }

    const chats = [...candidateChats.values()];
    let created = 0;
    let updated = 0;
    for (const chat of chats) {
      const result = await upsertTelegramChatDestination(accountId, chat);
      if (result.created) created++;
      else updated++;
    }
    const finalDestinations = await db.select().from(destinations).where(eq(destinations.socialAccountId, accountId));
    return {
      created,
      updated,
      discovered: chats.length,
      destinations: finalDestinations,
      warning: chats.length === 0
        ? "No chats discovered yet. Add the bot to a chat and send a message, or add a chat manually."
        : undefined,
    };
  }
}
