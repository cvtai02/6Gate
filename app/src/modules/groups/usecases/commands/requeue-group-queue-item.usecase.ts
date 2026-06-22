import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { groupUploadQueue } from "@/infrastructure/db/schema";
import { ensureGroup, QUEUE_STATUS_FAILED, QUEUE_STATUS_PENDING } from "../shared/group-helpers";
import { DispatchNextQueuedGroupUploadUseCase } from "./dispatch-next-queued-group-upload.usecase";

@Injectable()
export class RequeueGroupQueueItemUseCase {
  constructor(private readonly dispatchNextQueued: DispatchNextQueuedGroupUploadUseCase) {}

  async execute(groupId: string, itemId: string) {
    await ensureGroup(groupId);

    const updated = await getDb()
      .update(groupUploadQueue)
      .set({
        status: QUEUE_STATUS_PENDING,
        uploadBatchId: null,
        errorMessage: null,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(groupUploadQueue.id, itemId),
          eq(groupUploadQueue.groupId, groupId),
          eq(groupUploadQueue.status, QUEUE_STATUS_FAILED),
        ),
      )
      .returning()
      .then((r) => r[0]);

    if (!updated) {
      const err = new Error("Queue item not found or not in Failed status");
      (err as Error & { status?: number }).status = 400;
      throw err;
    }

    await this.dispatchNextQueued.execute(groupId).catch(() => undefined);

    return updated;
  }
}
