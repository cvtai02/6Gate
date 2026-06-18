import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { groupUploadSettings } from "@/infrastructure/db/schema";
import type { GroupUploadSettingsDto } from "../../dtos/group-upload-queue.dto";
import type { UpdateGroupUploadSettingsDto } from "../../dtos/update-group-upload-settings.dto";
import {
  assertUploadTimesInDay,
  DEFAULT_UPLOAD_TIMES,
  ensureGroup,
  ensureUploadSettings,
  localDateKey,
  localTimeKey,
  makeLastTriggeredSlot,
  parseUploadTimes,
  serializeUploadTimes,
} from "../shared/group-helpers";

@Injectable()
export class UpdateGroupUploadSettingsUseCase {
  async execute(groupId: string, input: UpdateGroupUploadSettingsDto): Promise<GroupUploadSettingsDto> {
    await ensureGroup(groupId);

    const times = input.uploadTimesInDay ?? parseUploadTimes(DEFAULT_UPLOAD_TIMES);
    assertUploadTimesInDay(times);
    const sorted = [...times].sort();
    const serialized = serializeUploadTimes(sorted);

    const now = new Date().toISOString();
    const existing = await getDb()
      .select()
      .from(groupUploadSettings)
      .where(eq(groupUploadSettings.groupId, groupId))
      .then((r) => r[0]);

    if (existing) {
      await getDb()
        .update(groupUploadSettings)
        .set({
          uploadTimeInDay: serialized,
          lastTriggeredDate: existing.uploadTimeInDay === serialized
            ? existing.lastTriggeredDate
            : latestPastSlot(sorted),
          updatedAt: now,
        })
        .where(eq(groupUploadSettings.groupId, groupId));
    } else {
      await getDb().insert(groupUploadSettings).values({
        groupId,
        uploadTimeInDay: serialized,
        lastTriggeredDate: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    return ensureUploadSettings(groupId);
  }
}

function latestPastSlot(sortedSlots: string[]): string | null {
  const today = localDateKey();
  const now = localTimeKey();
  let last: string | null = null;
  for (const slot of sortedSlots) {
    if (slot <= now) last = slot;
    else break;
  }
  return last ? makeLastTriggeredSlot(today, last) : null;
}
