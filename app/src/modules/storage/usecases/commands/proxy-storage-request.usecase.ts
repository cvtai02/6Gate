import { Injectable } from "@nestjs/common";
import { getDb } from "@/server/db";
import { router7 } from "@/server/db/schema";
import { env } from "@/server/config/env";
import { decryptValue } from "@/lib/crypto";

const DEFAULT_STORAGE_API_URL = "http://localhost:20131";

@Injectable()
export class ProxyStorageRequestUseCase {
  private getToken(row: { accessToken: string | null; baseUrl: string | null }) {
    const accessToken = row.accessToken ? decryptValue(row.accessToken, env.encryptionKey) : "";
    if (!accessToken) throw new Error("Storage access token not configured. Set it in Settings.");
    const bad = [...accessToken].find((c) => c.codePointAt(0)! > 127);
    if (bad) throw new Error(`Stored access token contains an invalid character (U+${bad.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}). Please re-enter it in Settings.`);
    const baseUrl = row.baseUrl?.trim() || DEFAULT_STORAGE_API_URL;
    return { accessToken, baseUrl };
  }

  async post(id: string, path: string, body: unknown): Promise<unknown> {
    const row = await getDb().select().from(router7).limit(1).then((r) => r[0]);
    if (!row) throw new Error("No storage provider configured.");
    const { accessToken, baseUrl } = this.getToken(row);

    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `Storage request failed (${res.status})`);
    return data;
  }

  async get(id: string, path: string): Promise<unknown> {
    const row = await getDb().select().from(router7).limit(1).then((r) => r[0]);
    if (!row) throw new Error("No storage provider configured.");
    const { accessToken, baseUrl } = this.getToken(row);

    const res = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `Storage request failed (${res.status})`);
    return data;
  }
}
