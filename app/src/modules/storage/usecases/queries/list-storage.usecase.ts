import { Injectable } from "@nestjs/common";
import { getDb } from "@/server/db";
import { router7 } from "@/server/db/schema";
import { env } from "@/server/config/env";
import { decryptValue } from "@/lib/crypto";

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
      accessToken: r.accessToken ? decryptValue(r.accessToken, env.systemSecret) : "",
      updatedAt: r.updatedAt,
    }));
  }
}
