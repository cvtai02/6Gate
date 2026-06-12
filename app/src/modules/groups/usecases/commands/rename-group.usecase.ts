import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { groups } from "@/infrastructure/db/schema";
import type { RenameGroupDto } from "../../dtos/rename-group.dto";

@Injectable()
export class RenameGroupUseCase {
  async execute(id: string, input: RenameGroupDto) {
    if (!input.name?.trim()) throw new Error("Name is required");

    const db = getDb();
    const row = await db.select().from(groups).where(eq(groups.id, id)).then((r) => r[0]);
    if (!row) return null;

    await db.update(groups).set({ name: input.name.trim() }).where(eq(groups.id, id));
    return db.select().from(groups).where(eq(groups.id, id)).then((r) => r[0]);
  }
}
