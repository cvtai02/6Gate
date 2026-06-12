import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/infrastructure/db";
import { destinations } from "@/infrastructure/db/schema";
import type { CreateDestinationDto } from "../../dtos/create-destination.dto";

@Injectable()
export class CreateDestinationUseCase {
  async execute(input: CreateDestinationDto) {
    const id = `dest_${nanoid(8)}`;
    await getDb().insert(destinations).values({
      id,
      socialAccountId: input.socialAccountId,
      name: input.name,
      type: input.type,
      externalId: input.externalId ?? null,
      createdAt: new Date().toISOString(),
    });
    return getDb().select().from(destinations).where(eq(destinations.id, id)).then((r) => r[0]);
  }
}
