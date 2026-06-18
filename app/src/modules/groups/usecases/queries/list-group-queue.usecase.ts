import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { groupUploadQueue } from "@/infrastructure/db/schema";
import type { GroupUploadQueueItemDto } from "../../dtos/group-upload-queue.dto";
import { ensureGroup } from "../shared/group-helpers";

@Injectable()
export class ListGroupQueueUseCase {
  async execute(groupId: string): Promise<GroupUploadQueueItemDto[]> {
    await ensureGroup(groupId);
    const rows = await getDb()
      .select()
      .from(groupUploadQueue)
      .where(eq(groupUploadQueue.groupId, groupId))
      .orderBy(desc(groupUploadQueue.createdAt));
    return rows.map((r) => ({
        id: r.id,
        groupId: r.groupId,
        videoPath: r.videoPath,
        title: r.title,
        caption: r.caption,
        privacy: r.privacy,
        status: r.status,
        uploadBatchId: r.uploadBatchId,
        errorMessage: r.errorMessage,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
  }
}
