import { Injectable } from "@nestjs/common";
import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { groupUploadQueue } from "@/server/db/schema";
import type { EnqueueGroupUploadDto } from "../../dtos/enqueue-group-upload.dto";
import type { GroupUploadQueueItemDto } from "../../dtos/group-upload-queue.dto";
import { assertExistingVideoPath, ensureGroup, QUEUE_STATUS_PENDING } from "../shared/group-helpers";

@Injectable()
export class EnqueueGroupUploadUseCase {
  async execute(groupId: string, input: EnqueueGroupUploadDto): Promise<GroupUploadQueueItemDto> {
    await ensureGroup(groupId);
    assertExistingVideoPath(input.videoPath);

    const now = new Date().toISOString();
    const item = {
      id: `gqueue_${nanoid(10)}`,
      groupId,
      videoPath: input.videoPath!,
      title: input.title ?? null,
      caption: input.caption ?? null,
      privacy: input.privacy ?? null,
      scheduledAt: input.scheduledAt ?? null,
      status: QUEUE_STATUS_PENDING,
      uploadBatchId: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };
    await getDb().insert(groupUploadQueue).values(item);
    return item;
  }
}
