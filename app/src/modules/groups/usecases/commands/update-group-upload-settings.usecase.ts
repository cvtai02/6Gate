import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { groupUploadSettings } from "@/server/db/schema";
import type { GroupUploadSettingsDto } from "../../dtos/group-upload-queue.dto";
import type { UpdateGroupUploadSettingsDto } from "../../dtos/update-group-upload-settings.dto";
import { assertUploadTimeInDay, DEFAULT_UPLOAD_TIME_IN_DAY, ensureGroup } from "../shared/group-helpers";

@Injectable()
export class UpdateGroupUploadSettingsUseCase {
  async execute(groupId: string, input: UpdateGroupUploadSettingsDto): Promise<GroupUploadSettingsDto> {
    await ensureGroup(groupId);
    const uploadTimeInDay = input.uploadTimeInDay ?? DEFAULT_UPLOAD_TIME_IN_DAY;
    assertUploadTimeInDay(uploadTimeInDay);

    const now = new Date().toISOString();
    const existing = await getDb()
      .select()
      .from(groupUploadSettings)
      .where(eq(groupUploadSettings.groupId, groupId))
      .get();
    if (existing) {
      await getDb()
        .update(groupUploadSettings)
        .set({
          uploadTimeInDay,
          lastTriggeredDate: existing.uploadTimeInDay === uploadTimeInDay ? existing.lastTriggeredDate : null,
          updatedAt: now,
        })
        .where(eq(groupUploadSettings.groupId, groupId));
    } else {
      await getDb().insert(groupUploadSettings).values({
        groupId,
        uploadTimeInDay,
        lastTriggeredDate: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    return (await getDb().select().from(groupUploadSettings).where(eq(groupUploadSettings.groupId, groupId)).get())!;
  }
}
