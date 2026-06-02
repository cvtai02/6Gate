import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { providers } from "@/server/db/schema";
import type { UpdateProviderDto } from "../../dtos/update-provider.dto";
import { getProviderOrThrow } from "../shared/provider-helpers";

@Injectable()
export class UpdateProviderUseCase {
  async execute(id: string, body: UpdateProviderDto) {
    const db = getDb();
    await getProviderOrThrow(id);
    const updates: Record<string, string | null> = {};
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
    if (typeof body.clientId === "string") updates.clientId = body.clientId.trim() || null;
    if (typeof body.clientSecret === "string" && body.clientSecret.trim()) updates.clientSecret = body.clientSecret.trim();
    if (typeof body.scopes === "string") updates.scopes = body.scopes.trim() || null;
    if (Array.isArray(body.scopes)) updates.scopes = body.scopes.join(",") || null;
    if (Object.keys(updates).length > 0) {
      await db.update(providers).set(updates).where(eq(providers.id, id));
    }
    return getProviderOrThrow(id);
  }
}
