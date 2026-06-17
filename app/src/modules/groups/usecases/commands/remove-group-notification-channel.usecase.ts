import { Injectable, NotFoundException } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { groupNotificationChannels } from "@/infrastructure/db/schema";

@Injectable()
export class RemoveGroupNotificationChannelUseCase {
  async execute(groupId: string, channelId: string) {
    const db = getDb();
    const deleted = await db
      .delete(groupNotificationChannels)
      .where(and(eq(groupNotificationChannels.id, channelId), eq(groupNotificationChannels.groupId, groupId)))
      .returning();
    if (deleted.length === 0) throw new NotFoundException("Notification channel not found");
    return { deleted: true };
  }
}
