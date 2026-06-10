import { Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { accounts, providers } from "@/server/db/schema";
import { ProviderType } from "@/lib/enums";
import type { AddTelegramAccountDto } from "../../dtos/add-telegram-account.dto";
import { AddTelegramChatUseCase } from "./add-telegram-chat.usecase";
import { telegramRequest, TelegramBotInfo } from "../shared/telegram-helpers";

@Injectable()
export class AddTelegramAccountUseCase {
  constructor(private readonly addTelegramChat: AddTelegramChatUseCase) {}

  async execute(input: AddTelegramAccountDto) {
    const botToken = input.botToken?.trim();
    if (!botToken) throw new Error("botToken is required");
    const bot = await telegramRequest<TelegramBotInfo>(botToken, "getMe");
    const chatId = input.chatId?.trim();

    const db = getDb();
    const now = new Date().toISOString();
    let provider = input.providerId
      ? await db.select().from(providers).where(eq(providers.id, input.providerId)).then((r) => r[0])
      : await db.select().from(providers).where(eq(providers.type, ProviderType.telegram)).then((r) => r[0]);

    if (input.providerId && !provider) throw new NotFoundException("Provider not found");
    if (provider && provider.type !== ProviderType.telegram) throw new Error("Provider is not a Telegram provider");

    if (!provider) {
      const providerId = `prov_${nanoid(10)}`;
      await db.insert(providers).values({
        id: providerId,
        name: "Telegram",
        type: ProviderType.telegram,
        clientId: null,
        clientSecret: null,
        authUrl: null,
        tokenUrl: null,
        scopes: null,
        pkceVerifier: null,
        createdAt: now,
      });
      provider = await db.select().from(providers).where(eq(providers.id, providerId)).then((r) => r[0]);
    }

    if (!provider) throw new Error("Failed to create Telegram provider");

    const accountId = `acc_tg_${nanoid(8)}`;
    const customName = input.name?.trim();
    const accountName = customName || bot.first_name || bot.username || "Telegram Bot";

    await db.insert(accounts).values({
      id: accountId,
      providerId: provider.id,
      providerAccountId: String(bot.id),
      displayName: accountName,
      username: bot.username ?? null,
      avatarUrl: null,
      accessToken: botToken,
      refreshToken: null,
      expiresAt: null,
      scopes: null,
      createdAt: now,
      updatedAt: now,
    });

    if (chatId) {
      await this.addTelegramChat.execute(accountId, { chatId, chatName: input.chatName });
    }

    return db.select().from(accounts).where(eq(accounts.id, accountId)).then((r) => r[0]);
  }
}
