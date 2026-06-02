import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { publishDestinations } from "@/server/db/schema";
import type { CreateDestinationDto } from "../../dtos/create-destination.dto";

@Injectable()
export class CreateDestinationUseCase {
  async execute(input: CreateDestinationDto) {
    const id = `dest_${nanoid(8)}`;
    await getDb().insert(publishDestinations).values({
      id,
      socialAccountId: input.socialAccountId,
      name: input.name,
      type: input.type,
      externalId: input.externalId ?? null,
      createdAt: new Date().toISOString(),
    });
    return getDb().select().from(publishDestinations).where(eq(publishDestinations.id, id)).get();
  }
}
