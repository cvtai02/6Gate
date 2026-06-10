import { Injectable } from "@nestjs/common";
import { desc } from "drizzle-orm";
import { getDb } from "@/server/db";
import { providers } from "@/server/db/schema";

@Injectable()
export class ListProvidersUseCase {
  execute() {
    return getDb().select().from(providers).orderBy(desc(providers.createdAt));
  }
}
