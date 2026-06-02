import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { groupDestinations, groupUploadQueue, groupUploadSettings, groups } from "@/server/db/schema";

@Injectable()
export class RemoveGroupUseCase {
  async execute(id: string) {
    const db = getDb();
    await db.delete(groupUploadQueue).where(eq(groupUploadQueue.groupId, id));
    await db.delete(groupUploadSettings).where(eq(groupUploadSettings.groupId, id));
    await db.delete(groupDestinations).where(eq(groupDestinations.groupId, id));
    await db.delete(groups).where(eq(groups.id, id));
  }
}
