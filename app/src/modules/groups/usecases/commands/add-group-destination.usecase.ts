import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { groupDestinations, destinations } from "@/server/db/schema";
import { ensureGroup } from "../shared/group-helpers";

@Injectable()
export class AddGroupDestinationUseCase {
  async execute(groupId: string, destinationId: string | undefined) {
    if (!destinationId) throw new Error("destinationId is required");

    const db = getDb();
    await ensureGroup(groupId);

    const dest = await db.select().from(destinations).where(eq(destinations.id, destinationId)).then((r) => r[0]);
    if (!dest) {
      const err = new Error("Destination not found");
      (err as Error & { status?: number }).status = 404;
      throw err;
    }

    const existing = await db
      .select()
      .from(groupDestinations)
      .where(and(eq(groupDestinations.groupId, groupId), eq(groupDestinations.destinationId, destinationId)))
      .then((r) => r[0]);
    if (existing) {
      const err = new Error("Already in group");
      (err as Error & { status?: number }).status = 409;
      throw err;
    }

    const id = `gdest_${nanoid(8)}`;
    await db.insert(groupDestinations).values({ id, groupId, destinationId, createdAt: new Date().toISOString() });
    return { id, groupId, destinationId };
  }
}
