import { NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { accounts } from "@/server/db/schema";

export async function getAccountOrThrow(id: string) {
  const row = await getDb().select().from(accounts).where(eq(accounts.id, id)).get();
  if (!row) throw new NotFoundException("Not found");
  return row;
}
