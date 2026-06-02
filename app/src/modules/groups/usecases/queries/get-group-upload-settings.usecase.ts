import { Injectable } from "@nestjs/common";
import type { GroupUploadSettingsDto } from "../../dtos/group-upload-queue.dto";
import { ensureGroup, ensureUploadSettings } from "../shared/group-helpers";

@Injectable()
export class GetGroupUploadSettingsUseCase {
  async execute(groupId: string): Promise<GroupUploadSettingsDto> {
    await ensureGroup(groupId);
    return ensureUploadSettings(groupId);
  }
}
