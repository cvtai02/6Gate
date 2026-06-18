import { Injectable, NotFoundException } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, groupNotificationChannels } from "@/infrastructure/db/schema";
import { telegramRequest } from "@/modules/accounts/usecases/shared/telegram-helpers";
import { decryptValue } from "@/core/security/crypto";
import { env } from "@/infrastructure/config/env";

@Injectable()
export class RemoveGroupNotificationChannelUseCase {
  async execute(groupId: string, channelId: string) {
    const db = getDb();
    const deleted = await db
      .delete(groupNotificationChannels)
      .where(and(eq(groupNotificationChannels.id, channelId), eq(groupNotificationChannels.groupId, groupId)))
      .returning();
    if (deleted.length === 0) throw new NotFoundException("Notification channel not found");

    const removedAccountId = deleted[0].accountId;
    const remaining = await db
      .select()
      .from(groupNotificationChannels)
      .where(eq(groupNotificationChannels.accountId, removedAccountId));

    if (remaining.length === 0) {
      const account = await db.select().from(accounts).where(eq(accounts.id, removedAccountId)).then((r) => r[0]);
      if (account?.accessToken) {
        const botToken = decryptValue(account.accessToken, env.encryptionKey);
        try {
          await telegramRequest(botToken, "deleteWebhook", {});
        } catch {}
      }
    }

    return { deleted: true };
  }
}
