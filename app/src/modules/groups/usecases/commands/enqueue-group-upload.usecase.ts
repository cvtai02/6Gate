import { Injectable } from "@nestjs/common";
import { nanoid } from "nanoid";
import { getDb } from "@/infrastructure/db";
import { groupUploadQueue } from "@/infrastructure/db/schema";
import type { EnqueueGroupUploadDto } from "../../dtos/enqueue-group-upload.dto";
import type { GroupUploadQueueItemDto } from "../../dtos/group-upload-queue.dto";
import { ensureGroup, QUEUE_STATUS_PENDING } from "../shared/group-helpers";
import { assertAbsolutePath, isUrl } from "../shared/storage-helper";

@Injectable()
export class EnqueueGroupUploadUseCase {
  async execute(groupId: string, input: EnqueueGroupUploadDto): Promise<GroupUploadQueueItemDto> {
    await ensureGroup(groupId);

    const videoPath = input.videoUrl ?? input.absolutePath;
    if (!input.videoUrl) assertAbsolutePath(input.absolutePath);
    if (!videoPath) throw new Error("Either absolutePath or videoUrl is required");

    const now = new Date().toISOString();
    const id = `gqueue_${nanoid(10)}`;
    await getDb().insert(groupUploadQueue).values({
      id,
      groupId,
      videoPath,
      title: input.title ?? null,
      caption: input.caption ?? null,
      privacy: input.privacy ?? null,
      status: QUEUE_STATUS_PENDING,
      uploadBatchId: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      groupId,
      absolutePath: videoPath,
      title: input.title ?? null,
      caption: input.caption ?? null,
      privacy: input.privacy ?? null,
      status: QUEUE_STATUS_PENDING,
      uploadBatchId: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };
  }
}
