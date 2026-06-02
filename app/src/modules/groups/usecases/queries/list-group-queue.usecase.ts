import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { groupUploadQueue } from "@/server/db/schema";
import type { GroupUploadQueueItemDto } from "../../dtos/group-upload-queue.dto";
import { ensureGroup } from "../shared/group-helpers";

@Injectable()
export class ListGroupQueueUseCase {
  async execute(groupId: string): Promise<GroupUploadQueueItemDto[]> {
    await ensureGroup(groupId);
    return getDb()
      .select()
      .from(groupUploadQueue)
      .where(eq(groupUploadQueue.groupId, groupId))
      .orderBy(desc(groupUploadQueue.createdAt))
      .all();
  }
}
