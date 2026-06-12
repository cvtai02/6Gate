import { Injectable } from "@nestjs/common";
import { desc } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { providers } from "@/infrastructure/db/schema";

@Injectable()
export class ListProvidersUseCase {
  execute() {
    return getDb().select().from(providers).orderBy(desc(providers.createdAt));
  }
}
