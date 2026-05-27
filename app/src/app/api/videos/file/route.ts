import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { getDb } from "@/server/db";
import { videoFolders } from "@/server/db/schema";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".m4v": "video/mp4",
  ".flv": "video/x-flv",
  ".wmv": "video/x-ms-wmv",
};

async function isPathAllowed(filePath: string): Promise<boolean> {
  const db = getDb();
  const folders = await db.select().from(videoFolders).all();
  return folders.some((f) => filePath.startsWith(f.path));
}

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath)
    return Response.json({ error: "path required" }, { status: 400 });
  if (!(await isPathAllowed(filePath)))
    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!fs.existsSync(filePath))
    return Response.json({ error: "File not found" }, { status: 404 });

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const mime = MIME[path.extname(filePath).toLowerCase()] ?? "video/mp4";
  const rangeHeader = req.headers.get("range");

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) return new Response("Invalid range", { status: 416 });

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : Math.min(start + 2 * 1024 * 1024 - 1, fileSize - 1);

    if (start >= fileSize)
      return new Response("Range not satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });

    const chunkSize = end - start + 1;
    const nodeStream = fs.createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize.toString(),
        "Content-Type": mime,
        "Cache-Control": "no-cache",
      },
    });
  }

  const nodeStream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Length": fileSize.toString(),
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    },
  });
}
