import { getDb } from "@/server/db";
import { groups, groupDestinations } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name } = await req.json();
  if (!name?.trim()) return Response.json({ error: "Name is required" }, { status: 400 });

  const db = getDb();
  const row = await db.select().from(groups).where(eq(groups.id, id)).get();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  await db.update(groups).set({ name: name.trim() }).where(eq(groups.id, id));
  const updated = await db.select().from(groups).where(eq(groups.id, id)).get();
  return Response.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  await db.delete(groupDestinations).where(eq(groupDestinations.groupId, id));
  await db.delete(groups).where(eq(groups.id, id));
  return new Response(null, { status: 204 });
}
