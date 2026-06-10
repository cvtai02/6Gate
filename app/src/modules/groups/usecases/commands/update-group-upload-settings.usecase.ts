import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { groupUploadSettings } from "@/server/db/schema";
import type { GroupUploadSettingsDto } from "../../dtos/group-upload-queue.dto";
import type { UpdateGroupUploadSettingsDto } from "../../dtos/update-group-upload-settings.dto";
import {
  assertUploadTimesInDay,
  DEFAULT_UPLOAD_TIMES,
  ensureGroup,
  ensureUploadSettings,
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
          // Reset trigger tracking when times change so the scheduler re-evaluates
          lastTriggeredDate: existing.uploadTimeInDay === serialized ? existing.lastTriggeredDate : null,
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
