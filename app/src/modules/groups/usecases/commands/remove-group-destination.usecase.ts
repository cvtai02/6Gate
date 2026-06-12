import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { groupDestinations } from "@/infrastructure/db/schema";

@Injectable()
export class RemoveGroupDestinationUseCase {
  async execute(groupId: string, destinationId: string) {
    await getDb()
      .delete(groupDestinations)
      .where(and(eq(groupDestinations.groupId, groupId), eq(groupDestinations.destinationId, destinationId)));
  }
}
