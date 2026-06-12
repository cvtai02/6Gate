import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts } from "@/infrastructure/db/schema";
import { getAccountOrThrow } from "../shared/account-helpers";

@Injectable()
export class RenameAccountUseCase {
  async execute(id: string, displayName: string) {
    await getAccountOrThrow(id);
    await getDb().update(accounts).set({ displayName, updatedAt: new Date().toISOString() }).where(eq(accounts.id, id));
    return { id, displayName };
  }
}
