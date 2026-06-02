import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { groupDestinations, publishDestinations } from "@/server/db/schema";

@Injectable()
export class DeleteDestinationUseCase {
  async execute(id: string) {
    const db = getDb();
    await db.delete(groupDestinations).where(eq(groupDestinations.destinationId, id));
    await db.delete(publishDestinations).where(eq(publishDestinations.id, id));
  }
}
