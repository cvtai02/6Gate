import { Injectable } from "@nestjs/common";
import { nanoid } from "nanoid";
import { getDb } from "@/infrastructure/db";
import { groupUploadQueue } from "@/infrastructure/db/schema";
import type { GroupUploadQueueItemDto } from "../../dtos/group-upload-queue.dto";
import type { UploadedFileMetadataDto } from "../../dtos/uploaded-file-metadata.dto";
import { ensureGroup, QUEUE_STATUS_PENDING } from "../shared/group-helpers";

@Injectable()
export class EnqueueGroupUploadFileUseCase {
  async execute(groupId: string, filePath: string, input: UploadedFileMetadataDto): Promise<GroupUploadQueueItemDto> {
    await ensureGroup(groupId);

    const now = new Date().toISOString();
    const id = `gqueue_${nanoid(10)}`;
    await getDb().insert(groupUploadQueue).values({
      id,
      groupId,
      videoPath: filePath,
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
      absolutePath: filePath,
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
