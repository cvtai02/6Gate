import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { nanoid } from "nanoid";

export function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export async function downloadFromUrl(videoUrl: string): Promise<string> {
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Failed to download video from URL (HTTP ${res.status})`);

  const contentType = res.headers.get("content-type") ?? "";
  const urlPath = new URL(videoUrl).pathname;
  const ext = urlPath.includes(".") ? urlPath.slice(urlPath.lastIndexOf(".")) : contentType.includes("mp4") ? ".mp4" : ".video";

  const tempDir = join(tmpdir(), "6gate-uploads");
  await mkdir(tempDir, { recursive: true });
  const tempPath = join(tempDir, `${nanoid(10)}${ext}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(tempPath, buffer);

  return tempPath;
}
