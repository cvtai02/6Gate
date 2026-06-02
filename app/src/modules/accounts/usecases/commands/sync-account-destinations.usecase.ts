import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { accounts, providers, publishDestinations } from "@/server/db/schema";
import { ProviderType } from "@/lib/enums";
import { SyncTelegramChatsUseCase } from "./sync-telegram-chats.usecase";
import { SyncZernioUseCase } from "./sync-zernio.usecase";

@Injectable()
export class SyncAccountDestinationsUseCase {
  constructor(
    private readonly syncTelegramChats: SyncTelegramChatsUseCase,
    private readonly syncZernio: SyncZernioUseCase,
  ) {}

  async execute(accountId: string) {
    const db = getDb();
    const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).get();
    if (!account) return { error: "Not found" };
    const provider = await db.select().from(providers).where(eq(providers.id, account.providerId)).get();
    if (!provider) return { error: "Provider not found" };
    if (provider.type === ProviderType.zernio) {
      await this.syncZernio.execute({ accountId });
      const dests = await db.select().from(publishDestinations).where(eq(publishDestinations.socialAccountId, accountId)).all();
      return { destinations: dests };
    }
    if (provider.type === ProviderType.telegram) {
      return this.syncTelegramChats.execute(accountId);
    }
    const existing = await db.select().from(publishDestinations).where(eq(publishDestinations.socialAccountId, accountId)).all();
    return { destinations: existing, warning: existing.length === 0 ? "No destinations available for this account." : undefined };
  }
}
