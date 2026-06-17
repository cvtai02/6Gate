import { Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/infrastructure/db";
import { groups, groupNotificationChannels } from "@/infrastructure/db/schema";
import type { UpdateGroupTelegramNotifyDto } from "../../dtos/update-group-telegram-notify.dto";

@Injectable()
export class UpdateGroupTelegramNotifyUseCase {
  async execute(groupId: string, input: UpdateGroupTelegramNotifyDto) {
    const db = getDb();
    const group = await db.select().from(groups).where(eq(groups.id, groupId)).then((r) => r[0]);
    if (!group) throw new NotFoundException("Group not found");

    await db.delete(groupNotificationChannels).where(eq(groupNotificationChannels.groupId, groupId));

    if (input.telegramBotAccountId && input.telegramChatId) {
      await db.insert(groupNotificationChannels).values({
        id: `gnc_${nanoid(10)}`,
        groupId,
        accountId: input.telegramBotAccountId,
        chatId: input.telegramChatId,
        createdAt: new Date().toISOString(),
      });
    }

    return {
      telegramBotAccountId: input.telegramBotAccountId,
      telegramChatId: input.telegramChatId,
    };
  }
}
