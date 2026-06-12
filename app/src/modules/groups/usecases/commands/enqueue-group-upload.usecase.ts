import { Injectable } from "@nestjs/common";
import { nanoid } from "nanoid";
import { getDb } from "@/infrastructure/db";
import { groupUploadQueue } from "@/infrastructure/db/schema";
import type { EnqueueGroupUploadDto } from "../../dtos/enqueue-group-upload.dto";
import type { GroupUploadQueueItemDto } from "../../dtos/group-upload-queue.dto";
import { ensureGroup, QUEUE_STATUS_PENDING } from "../shared/group-helpers";
import { assertAbsolutePath } from "../shared/storage-helper";

@Injectable()
export class EnqueueGroupUploadUseCase {
  async execute(groupId: string, input: EnqueueGroupUploadDto): Promise<GroupUploadQueueItemDto> {
    await ensureGroup(groupId);
    assertAbsolutePath(input.absolutePath);

    const now = new Date().toISOString();
    const id = `gqueue_${nanoid(10)}`;
    await getDb().insert(groupUploadQueue).values({
      id,
      groupId,
      videoPath: input.absolutePath,
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
      absolutePath: input.absolutePath,
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
