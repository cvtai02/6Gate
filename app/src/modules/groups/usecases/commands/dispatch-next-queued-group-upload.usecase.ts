import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { groupUploadQueue } from "@/server/db/schema";
import { CreateGroupUploadJobsUseCase } from "./create-group-upload-jobs.usecase";
import {
  LOCAL_SCHEDULER_BASE_URL,
  QUEUE_STATUS_DISPATCHED,
  QUEUE_STATUS_FAILED,
  QUEUE_STATUS_PENDING,
} from "../shared/group-helpers";

@Injectable()
export class DispatchNextQueuedGroupUploadUseCase {
  constructor(private readonly createUploadJobs: CreateGroupUploadJobsUseCase) {}

  async execute(groupId: string) {
    const db = getDb();
    const next = await db
      .select()
      .from(groupUploadQueue)
      .where(and(eq(groupUploadQueue.groupId, groupId), eq(groupUploadQueue.status, QUEUE_STATUS_PENDING)))
      .orderBy(groupUploadQueue.createdAt)
      .limit(1)
      .get();

    if (!next) return null;

    try {
      const result = await this.createUploadJobs.execute(
        groupId,
        {
          videoPath: next.videoPath,
          title: next.title ?? undefined,
          caption: next.caption ?? undefined,
          privacy: next.privacy ?? undefined,
          scheduledAt: next.scheduledAt ?? undefined,
        },
        LOCAL_SCHEDULER_BASE_URL,
      );
      await db
        .update(groupUploadQueue)
        .set({
          status: QUEUE_STATUS_DISPATCHED,
          uploadBatchId: result.uploadBatchId,
          errorMessage: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(groupUploadQueue.id, next.id));
      return result;
    } catch (err) {
      await db
        .update(groupUploadQueue)
        .set({
          status: QUEUE_STATUS_FAILED,
          errorMessage: err instanceof Error ? err.message : String(err),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(groupUploadQueue.id, next.id));
      throw err;
    }
  }
}
