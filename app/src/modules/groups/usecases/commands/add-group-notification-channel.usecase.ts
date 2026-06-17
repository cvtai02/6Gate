import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/infrastructure/db";
import { accounts, groups, groupNotificationChannels } from "@/infrastructure/db/schema";

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
