import { getDb } from "@/server/db";
import { groupDestinations } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; destinationId: string }> }
) {
  const { id: groupId, destinationId } = await params;
  const db = getDb();
  await db
    .delete(groupDestinations)
    .where(and(eq(groupDestinations.groupId, groupId), eq(groupDestinations.destinationId, destinationId)));
  return new Response(null, { status: 204 });
}
