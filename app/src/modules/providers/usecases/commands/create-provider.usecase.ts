import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { providers } from "@/server/db/schema";
import type { CreateProviderDto } from "../../dtos/create-provider.dto";

@Injectable()
export class CreateProviderUseCase {
  async execute(input: CreateProviderDto) {
    const db = getDb();
    const existing = await db.select({ id: providers.id }).from(providers).where(eq(providers.type, input.type)).get();
    if (existing) {
      throw new Error(`A ${input.type} app is already configured. Edit or remove it first.`);
    }
    const id = `prov_${nanoid(10)}`;
    const now = new Date().toISOString();
    await db.insert(providers).values({
      id,
      name: input.name,
      type: input.type,
      clientId: input.clientId ?? null,
      clientSecret: input.clientSecret ?? null,
      authUrl: input.authUrl ?? null,
      tokenUrl: input.tokenUrl ?? null,
      scopes: input.scopes ? input.scopes.join(",") : null,
      createdAt: now,
    });
    return db.select().from(providers).where(eq(providers.id, id)).get();
  }
}
