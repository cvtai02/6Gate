import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { groupUploadSettings, groups } from "@/server/db/schema";
import type { CreateGroupDto } from "../../dtos/create-group.dto";
import { DEFAULT_UPLOAD_TIMES, toSnakeCaseId } from "../shared/group-helpers";

@Injectable()
export class CreateGroupUseCase {
  async execute(input: CreateGroupDto) {
    if (!input.name?.trim()) throw new Error("Name is required");

    const id = toSnakeCaseId(input.name);
    if (!id) throw new Error("Name must contain letters or numbers");

    const db = getDb();
    const existing = await db.select().from(groups).where(eq(groups.id, id)).then((r) => r[0]);
    if (existing) {
      const err = new Error(`A group with id "${id}" already exists. Choose a different name.`);
      (err as Error & { status?: number }).status = 409;
      throw err;
    }

    const now = new Date().toISOString();
    await db.insert(groups).values({ id, name: input.name.trim(), createdAt: now });
    await db.insert(groupUploadSettings).values({
      groupId: id,
      uploadTimeInDay: DEFAULT_UPLOAD_TIMES,
      lastTriggeredDate: null,
      createdAt: now,
      updatedAt: now,
    });
    const row = await db.select().from(groups).where(eq(groups.id, id)).then((r) => r[0]);
    return { ...row, destinations: [] };
  }
}
