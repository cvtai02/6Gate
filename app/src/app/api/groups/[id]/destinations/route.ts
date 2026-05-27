import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { groups, groupDestinations, publishDestinations } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  const { destinationId } = await req.json();
  if (!destinationId) {
    return Response.json({ error: "destinationId is required" }, { status: 400 });
  }

  const db = getDb();
  const group = await db.select().from(groups).where(eq(groups.id, groupId)).get();
  if (!group) return Response.json({ error: "Group not found" }, { status: 404 });

  const dest = await db.select().from(publishDestinations).where(eq(publishDestinations.id, destinationId)).get();
  if (!dest) return Response.json({ error: "Destination not found" }, { status: 404 });

  const existing = await db
    .select()
    .from(groupDestinations)
    .where(and(eq(groupDestinations.groupId, groupId), eq(groupDestinations.destinationId, destinationId)))
    .get();
  if (existing) return Response.json({ error: "Already in group" }, { status: 409 });

  const id = `gdest_${nanoid(8)}`;
  await db.insert(groupDestinations).values({ id, groupId, destinationId, createdAt: new Date().toISOString() });
  return Response.json({ id, groupId, destinationId }, { status: 201 });
}
