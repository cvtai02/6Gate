import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { groupUploadQueue } from "@/infrastructure/db/schema";
import {
  ensureGroup,
  ensureUploadSettings,
  localDateKey,
  localTimeKey,
  parseLastTriggeredSlot,
  QUEUE_STATUS_PENDING,
} from "../shared/group-helpers";

export interface NextUploadTimeDto {
  groupId: string;
  uploadTimesInDay: string[];
  pendingCount: number;
  nextUploadAt: string | null;
}

@Injectable()
export class GetNextUploadTimeUseCase {
  async execute(groupId: string): Promise<NextUploadTimeDto> {
    await ensureGroup(groupId);
    const settings = await ensureUploadSettings(groupId);

    const pending = await getDb()
      .select({ id: groupUploadQueue.id })
      .from(groupUploadQueue)
      .where(and(eq(groupUploadQueue.groupId, groupId), eq(groupUploadQueue.status, QUEUE_STATUS_PENDING)))
      ;

    if (pending.length === 0) {
      return { groupId, uploadTimesInDay: settings.uploadTimesInDay, pendingCount: 0, nextUploadAt: null };
    }

    const today = localDateKey();
    const nowTime = localTimeKey();
    const lastSlot = parseLastTriggeredSlot(settings.lastTriggeredDate);
    const sortedSlots = [...settings.uploadTimesInDay].sort();

    // Find the next slot that hasn't fired yet
    let nextUploadAt: Date | null = null;

    // Check today's remaining slots
    for (const slot of sortedSlots) {
      if (slot <= nowTime) continue;

      const alreadyTriggeredToday =
        lastSlot !== null &&
        lastSlot.date === today &&
        slot <= lastSlot.slot;

      if (alreadyTriggeredToday) continue;

      const [hour, minute] = slot.split(":").map(Number);
      const candidate = new Date();
      candidate.setHours(hour, minute, 0, 0);
      nextUploadAt = candidate;
      break;
    }

    // If all today's slots are done, use the first slot tomorrow
    if (!nextUploadAt) {
      const [hour, minute] = sortedSlots[0].split(":").map(Number);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(hour, minute, 0, 0);
      nextUploadAt = tomorrow;
    }

    return {
      groupId,
      uploadTimesInDay: settings.uploadTimesInDay,
      pendingCount: pending.length,
      nextUploadAt: nextUploadAt.toISOString(),
    };
  }
}
