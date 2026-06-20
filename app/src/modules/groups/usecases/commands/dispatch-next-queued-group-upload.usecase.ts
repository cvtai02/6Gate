import { Injectable } from "@nestjs/common";
import { existsSync } from "fs";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { groupUploadQueue } from "@/infrastructure/db/schema";
import { CreateGroupUploadJobsUseCase } from "./create-group-upload-jobs.usecase";
import {
  LOCAL_SCHEDULER_BASE_URL,
  QUEUE_STATUS_DISPATCHED,
  QUEUE_STATUS_FAILED,
  QUEUE_STATUS_PENDING,
} from "../shared/group-helpers";
import { downloadRouter7File, isRouter7Path } from "@/infrastructure/providers/router7";

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
      .then((r) => r[0]);

    if (!next) return null;

    // Atomic claim: only proceed if we successfully flip Pending → Dispatched
    const claimed = await db
      .update(groupUploadQueue)
      .set({ status: QUEUE_STATUS_DISPATCHED, updatedAt: new Date().toISOString() })
      .where(and(eq(groupUploadQueue.id, next.id), eq(groupUploadQueue.status, QUEUE_STATUS_PENDING)))
      .returning()
      .then((r) => r[0]);

    if (!claimed) return null;

    try {
      const metadata = {
        title: next.title ?? undefined,
        caption: next.caption ?? undefined,
        privacy: next.privacy ?? undefined,
      };
      let result;
      if (existsSync(next.videoPath)) {
        result = await this.createUploadJobs.executeFromLocalFile(groupId, next.videoPath, metadata, LOCAL_SCHEDULER_BASE_URL);
      } else if (isRouter7Path(next.videoPath)) {
        const localFile = await downloadRouter7File(next.videoPath);
        result = await this.createUploadJobs.executeFromLocalFile(groupId, localFile, metadata, LOCAL_SCHEDULER_BASE_URL);
      } else {
        result = await this.createUploadJobs.execute(groupId, { videoUrl: next.videoPath, ...metadata }, LOCAL_SCHEDULER_BASE_URL);
      }
      await db
        .update(groupUploadQueue)
        .set({
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
