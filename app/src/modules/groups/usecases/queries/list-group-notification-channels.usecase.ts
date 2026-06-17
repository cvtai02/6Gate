import { Injectable, NotFoundException } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, groups, groupNotificationChannels } from "@/infrastructure/db/schema";

@Injectable()
export class ListGroupNotificationChannelsUseCase {
  async execute(groupId: string) {
    const db = getDb();
    const group = await db.select().from(groups).where(eq(groups.id, groupId)).then((r) => r[0]);
    if (!group) throw new NotFoundException("Group not found");

    const channels = await db.select().from(groupNotificationChannels).where(eq(groupNotificationChannels.groupId, groupId));
    if (channels.length === 0) return [];

    const accountIds = [...new Set(channels.map((c) => c.accountId))];
    const accountRows = await db.select().from(accounts).where(inArray(accounts.id, accountIds));
    const accountMap = new Map(accountRows.map((a) => [a.id, a]));

    return channels.map((ch) => {
      const acc = accountMap.get(ch.accountId);
      return {
        id: ch.id,
        accountId: ch.accountId,
        chatId: ch.chatId,
        chatName: ch.chatName,
        botName: acc?.displayName ?? acc?.username ?? null,
        providerType: "telegram",
        createdAt: ch.createdAt,
      };
    });
  }
}
