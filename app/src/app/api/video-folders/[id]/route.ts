import { getDb } from "@/server/db";
import { videoFolders } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const row = await db.select().from(videoFolders).where(eq(videoFolders.id, id)).get();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  await db.delete(videoFolders).where(eq(videoFolders.id, id));
  return new Response(null, { status: 204 });
}
