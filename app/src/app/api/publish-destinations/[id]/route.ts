import { getDb } from "@/server/db";
import { publishDestinations, groupDestinations } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  await db.delete(groupDestinations).where(eq(groupDestinations.destinationId, id));
  await db.delete(publishDestinations).where(eq(publishDestinations.id, id));
  return new Response(null, { status: 204 });
}
