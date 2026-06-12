import { Injectable } from "@nestjs/common";
import { getDb } from "@/infrastructure/db";
import { router7 } from "@/infrastructure/db/schema";
import { env } from "@/infrastructure/config/env";
import { decryptValue } from "@/core/security/crypto";

export type StorageDto = {
  id: string;
  name: string;
  baseUrl: string;
  accessToken: string;
  updatedAt: string;
};

@Injectable()
export class ListStorageUseCase {
  async execute(): Promise<StorageDto[]> {
    const rows = await getDb().select().from(router7);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      baseUrl: r.baseUrl ?? "",
      accessToken: r.accessToken ? decryptValue(r.accessToken, env.encryptionKey) : "",
      updatedAt: r.updatedAt,
    }));
  }
}
