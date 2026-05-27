import { nanoid } from "nanoid";
import { z } from "zod";
import { getDb } from "@/server/db";
import { videoFolders } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";

export const dynamic = "force-dynamic";

const Schema = z.object({
  path: z.string().min(1),
  label: z.string().min(1),
});

export async function GET() {
  const db = getDb();
  return Response.json(await db.select().from(videoFolders).all());
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.message }, { status: 400 });

  const { path, label } = parsed.data;

  if (!fs.existsSync(path))
    return Response.json({ error: `Folder not found: ${path}` }, { status: 400 });

  const db = getDb();
  const existing = await db
    .select()
    .from(videoFolders)
    .where(eq(videoFolders.path, path))
    .get();
  if (existing)
    return Response.json({ error: "Folder already added" }, { status: 409 });

  const id = `vf_${nanoid(8)}`;
  const now = new Date().toISOString();
  await db.insert(videoFolders).values({ id, path, label, createdAt: now });
  return Response.json({ id, path, label, createdAt: now }, { status: 201 });
}
