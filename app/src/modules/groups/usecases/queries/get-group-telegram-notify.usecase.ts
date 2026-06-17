import { Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, groups, groupNotificationChannels } from "@/infrastructure/db/schema";

@Injectable()
export class GetGroupTelegramNotifyUseCase {
  async execute(groupId: string) {
    const db = getDb();
    const group = await db.select().from(groups).where(eq(groups.id, groupId)).then((r) => r[0]);
    if (!group) throw new NotFoundException("Group not found");

    const channel = await db.select().from(groupNotificationChannels)
      .where(eq(groupNotificationChannels.groupId, groupId))
      .then((r) => r[0]);

    if (!channel) {
      return { telegramBotAccountId: null, telegramChatId: null, botName: null };
    }

    const account = await db.select().from(accounts).where(eq(accounts.id, channel.accountId)).then((r) => r[0]);
    return {
      telegramBotAccountId: channel.accountId,
      telegramChatId: channel.chatId,
      botName: account?.displayName ?? account?.username ?? null,
    };
  }
}
