import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/infrastructure/db";
import { accounts, groups, groupNotificationChannels } from "@/infrastructure/db/schema";
import { telegramRequest } from "@/modules/accounts/usecases/shared/telegram-helpers";
import { decryptValue } from "@/core/security/crypto";
import { env } from "@/infrastructure/config/env";

@Injectable()
export class AddGroupNotificationChannelUseCase {
  async execute(groupId: string, input: { accountId: string; chatId: string; chatName?: string }) {
    const db = getDb();
    const group = await db.select().from(groups).where(eq(groups.id, groupId)).then((r) => r[0]);
    if (!group) throw new NotFoundException("Group not found");

    const account = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).then((r) => r[0]);
    if (!account) throw new BadRequestException("Account not found");

    const id = `gnc_${nanoid(10)}`;
    const now = new Date().toISOString();
    await db.insert(groupNotificationChannels).values({
      id,
      groupId,
      accountId: input.accountId,
      chatId: input.chatId,
      chatName: input.chatName ?? null,
      createdAt: now,
    });

    if (account.accessToken) {
      const botToken = decryptValue(account.accessToken, env.encryptionKey);
      const webhookUrl = `${env.webhookBaseUrl}/api/webhooks/telegram/${input.accountId}`;
      try {
        await telegramRequest(botToken, "setWebhook", {
          url: webhookUrl,
          allowed_updates: ["message"],
        });
      } catch {}
    }

    return {
      id,
      accountId: input.accountId,
      chatId: input.chatId,
      chatName: input.chatName ?? null,
      botName: account.displayName ?? account.username ?? null,
      providerType: "telegram",
      createdAt: now,
    };
  }
}
