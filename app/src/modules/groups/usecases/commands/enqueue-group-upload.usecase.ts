import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/infrastructure/db";
import { groupUploadQueue, groupUploadSettings } from "@/infrastructure/db/schema";
import type { EnqueueGroupUploadDto } from "../../dtos/enqueue-group-upload.dto";
import type { GroupUploadQueueItemDto } from "../../dtos/group-upload-queue.dto";
import { ensureGroup, QUEUE_STATUS_PENDING } from "../shared/group-helpers";
import { DispatchNextQueuedGroupUploadUseCase } from "./dispatch-next-queued-group-upload.usecase";

@Injectable()
export class EnqueueGroupUploadUseCase {
  constructor(private readonly dispatchNextQueued: DispatchNextQueuedGroupUploadUseCase) {}

  async execute(groupId: string, input: EnqueueGroupUploadDto): Promise<GroupUploadQueueItemDto> {
    await ensureGroup(groupId);

    const videoPath = input.videoUrl;
    if (!videoPath) throw new Error("videoUrl is required");

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
      sourceChatId: input.sourceChatId ?? null,
      sourceAccountId: input.sourceAccountId ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const hasSchedule = await getDb()
      .select({ groupId: groupUploadSettings.groupId })
      .from(groupUploadSettings)
      .where(eq(groupUploadSettings.groupId, groupId))
      .then((r) => r[0]);

    if (!hasSchedule) {
      await this.dispatchNextQueued.execute(groupId).catch(() => undefined);
    }

    return {
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
    };
  }
}
