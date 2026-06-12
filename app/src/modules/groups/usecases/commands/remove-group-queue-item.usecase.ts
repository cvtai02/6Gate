import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { groupUploadQueue } from "@/infrastructure/db/schema";
import { ensureGroup } from "../shared/group-helpers";

@Injectable()
export class RemoveGroupQueueItemUseCase {
  async execute(groupId: string, itemId: string) {
    await ensureGroup(groupId);
    await getDb()
      .delete(groupUploadQueue)
      .where(and(eq(groupUploadQueue.groupId, groupId), eq(groupUploadQueue.id, itemId)));
  }
}
