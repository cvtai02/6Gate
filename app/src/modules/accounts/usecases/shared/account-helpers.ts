import { NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts } from "@/infrastructure/db/schema";

export async function getAccountOrThrow(id: string) {
  const row = await getDb().select().from(accounts).where(eq(accounts.id, id)).then((r) => r[0]);
  if (!row) throw new NotFoundException("Not found");
  return row;
}
