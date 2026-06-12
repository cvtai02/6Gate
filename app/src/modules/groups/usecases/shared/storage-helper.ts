import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { nanoid } from "nanoid";
import { getDb } from "@/infrastructure/db";
import { router7 } from "@/infrastructure/db/schema";
import { env } from "@/infrastructure/config/env";
import { decryptValue } from "@/core/security/crypto";

const DEFAULT_STORAGE_API_URL = "http://localhost:20131";

async function getStorageProvider() {
  const row = await getDb().select().from(router7).limit(1).then((r) => r[0]);
  if (!row) throw new Error("No storage provider configured.");
  const accessToken = row.accessToken ? decryptValue(row.accessToken, env.encryptionKey) : "";
  const baseUrl = row.baseUrl?.trim() || DEFAULT_STORAGE_API_URL;
  return { accessToken, baseUrl };
}

export function assertAbsolutePath(value: string | undefined) {
  if (!value) throw new Error("absolutePath is required");
  if (!value.includes("/")) throw new Error("absolutePath must be in 7router format: Provider/account/bucket/path/file");
}

export async function downloadFromStorage(absolutePath: string): Promise<string> {
  const { accessToken, baseUrl } = await getStorageProvider();
  if (!accessToken) throw new Error("Storage access token not configured. Set it in Settings.");

  const res = await fetch(`${baseUrl}/files/get`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ absolutePath }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Storage download failed (HTTP ${res.status})`);

  const file = data.file as { name: string; contentBase64: string; contentType?: string };
  if (!file?.contentBase64) throw new Error("Storage response missing file content");

  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const tempDir = join(tmpdir(), "6gate-uploads");
  await mkdir(tempDir, { recursive: true });
  const tempPath = join(tempDir, `${nanoid(10)}${ext}`);

  const buffer = Buffer.from(file.contentBase64, "base64");
  await writeFile(tempPath, buffer);

  return tempPath;
}
