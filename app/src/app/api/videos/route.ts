import fs from "fs";
import path from "path";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { videoFolders } from "@/server/db/schema";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const VIDEO_EXTS = new Set([".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".flv", ".wmv"]);

function isVideo(file: string) {
  return VIDEO_EXTS.has(path.extname(file).toLowerCase());
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

async function isPathAllowed(filePath: string) {
  const db = getDb();
  const folders = await db.select().from(videoFolders).all();
  return folders.some((f) => filePath.startsWith(f.path));
}

export async function GET(req: NextRequest) {
  const folderId = req.nextUrl.searchParams.get("folderId");
  if (!folderId)
    return Response.json({ error: "folderId required" }, { status: 400 });

  const db = getDb();
  const folder = await db
    .select()
    .from(videoFolders)
    .where(eq(videoFolders.id, folderId))
    .get();

  if (!folder) return Response.json({ error: "Folder not found" }, { status: 404 });

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(folder.path, { withFileTypes: true });
  } catch {
    return Response.json({ error: `Cannot read folder: ${folder.path}` }, { status: 500 });
  }

  const videos = entries
    .filter((e) => e.isFile() && isVideo(e.name))
    .map((e) => {
      const filePath = path.join(folder.path, e.name);
      const stat = fs.statSync(filePath);
      return {
        name: e.name,
        path: filePath,
        size: stat.size,
        sizeLabel: formatSize(stat.size),
        mtime: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));

  return Response.json(videos);
}

export async function DELETE(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath)
    return Response.json({ error: "path required" }, { status: 400 });
  if (!(await isPathAllowed(filePath)))
    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!fs.existsSync(filePath))
    return Response.json({ error: "File not found" }, { status: 404 });

  fs.unlinkSync(filePath);
  return new Response(null, { status: 204 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const parsed = z
    .object({ path: z.string(), newName: z.string().min(1) })
    .safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.message }, { status: 400 });

  const { path: filePath, newName } = parsed.data;
  if (!(await isPathAllowed(filePath)))
    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!fs.existsSync(filePath))
    return Response.json({ error: "File not found" }, { status: 404 });

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const safeName = newName.endsWith(ext) ? newName : newName + ext;
  const newPath = path.join(dir, safeName);

  if (fs.existsSync(newPath))
    return Response.json({ error: "A file with that name already exists" }, { status: 409 });

  fs.renameSync(filePath, newPath);
  return Response.json({ path: newPath, name: safeName });
}
