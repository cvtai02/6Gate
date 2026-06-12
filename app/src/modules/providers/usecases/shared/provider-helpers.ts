import { NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { providers } from "@/infrastructure/db/schema";

export async function getProviderOrThrow(id: string) {
  const row = await getDb().select().from(providers).where(eq(providers.id, id)).then((r) => r[0]);
  if (!row) throw new NotFoundException("Not found");
  return row;
}
