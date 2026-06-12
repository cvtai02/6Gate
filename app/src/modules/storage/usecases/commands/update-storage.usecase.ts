import { Injectable } from "@nestjs/common";
import { getDb } from "@/infrastructure/db";
import { router7 } from "@/infrastructure/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/infrastructure/config/env";
import { encryptValue } from "@/core/security/crypto";
import type { StorageDto } from "../queries/list-storage.usecase";

@Injectable()
export class UpdateStorageUseCase {
  async execute(id: string, patch: { baseUrl?: string; accessToken?: string }): Promise<StorageDto> {
    const db = getDb();
    const existing = await db.select().from(router7).where(eq(router7.id, id)).limit(1).then((r) => r[0]);
    if (!existing) throw new Error(`Storage provider '${id}' not found`);

    if (patch.accessToken !== undefined) {
      const bad = [...patch.accessToken].find((c) => c.codePointAt(0)! > 127);
      if (bad) throw new Error(`Access token contains an invalid character (U+${bad.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}). Make sure you copy the raw token without any formatting.`);
    }

    const updatedAt = new Date().toISOString();
    const storedToken =
      patch.accessToken !== undefined
        ? encryptValue(patch.accessToken, env.encryptionKey)
        : existing.accessToken;

    await db.update(router7)
      .set({
        baseUrl: patch.baseUrl ?? existing.baseUrl,
        accessToken: storedToken,
        updatedAt,
      })
      .where(eq(router7.id, id));

    return {
      id,
      name: existing.name,
      baseUrl: patch.baseUrl ?? existing.baseUrl ?? "",
      accessToken: patch.accessToken ?? "",
      updatedAt,
    };
  }
}
