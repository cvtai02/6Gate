import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import {
  groups,
  groupUploadSettings,
  groupUploadQueue,
} from "@/infrastructure/db/schema";
import {
  DEFAULT_UPLOAD_TIMES,
  QUEUE_STATUS_PENDING,
  localDateKey,
  localTimeKey,
  parseLastTriggeredSlot,
  parseUploadTimes,
} from "../shared/group-helpers";

export interface ScheduleOverviewItemDto {
  groupId: string;
  groupName: string;
  uploadTimesInDay: string[];
  pendingCount: number;
  nextUploadAt: string | null;
  lastTriggeredDate: string | null;
}

@Injectable()
export class ListAllSchedulesUseCase {
  async execute(): Promise<ScheduleOverviewItemDto[]> {
    const db = getDb();
    const allGroups = await db.select().from(groups);
    const allSettings = await db.select().from(groupUploadSettings);
    const pendingCounts = await db
      .select({ groupId: groupUploadQueue.groupId, id: groupUploadQueue.id })
      .from(groupUploadQueue)
      .where(eq(groupUploadQueue.status, QUEUE_STATUS_PENDING));

    const settingsMap = new Map(allSettings.map((s) => [s.groupId, s]));
    const countMap = new Map<string, number>();
    for (const row of pendingCounts) {
      countMap.set(row.groupId, (countMap.get(row.groupId) ?? 0) + 1);
    }

    const today = localDateKey();
    const nowTime = localTimeKey();

    return allGroups.map((group) => {
      const setting = settingsMap.get(group.id);
      const uploadTimesInDay = setting
        ? parseUploadTimes(setting.uploadTimeInDay)
        : [DEFAULT_UPLOAD_TIMES];
      const pendingCount = countMap.get(group.id) ?? 0;
      const lastSlot = setting ? parseLastTriggeredSlot(setting.lastTriggeredDate) : null;

      let nextUploadAt: string | null = null;
      if (pendingCount > 0) {
        const sortedSlots = [...uploadTimesInDay].sort();
        let found: Date | null = null;
        for (const slot of sortedSlots) {
          if (slot <= nowTime) continue;
          const alreadyTriggeredToday =
            lastSlot !== null && lastSlot.date === today && slot <= lastSlot.slot;
          if (alreadyTriggeredToday) continue;
          const [hour, minute] = slot.split(":").map(Number);
          const candidate = new Date();
          candidate.setHours(hour, minute, 0, 0);
          found = candidate;
          break;
        }
        if (!found) {
          const [hour, minute] = sortedSlots[0].split(":").map(Number);
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(hour, minute, 0, 0);
          found = tomorrow;
        }
        nextUploadAt = found.toISOString();
      }

      return {
        groupId: group.id,
        groupName: group.name,
        uploadTimesInDay,
        pendingCount,
        nextUploadAt,
        lastTriggeredDate: setting?.lastTriggeredDate ?? null,
      };
    });
  }
}
