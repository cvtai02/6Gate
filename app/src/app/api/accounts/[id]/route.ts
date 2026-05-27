import { getDb } from "@/server/db";
import { accounts, postJobs, jobLogs, publishDestinations, groupDestinations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({ displayName: z.string().min(1) });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const db = getDb();
  const row = await db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  await db
    .update(accounts)
    .set({ displayName: parsed.data.displayName, updatedAt: new Date().toISOString() })
    .where(eq(accounts.id, id));

  return Response.json({ id, displayName: parsed.data.displayName });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = await db.select().from(accounts).where(eq(accounts.id, id)).get();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });

    // Cascade: delete job_logs → post_jobs → combo_destinations → publish_destinations → account
    const jobs = await db.select({ id: postJobs.id }).from(postJobs).where(eq(postJobs.accountId, id)).all();
    for (const job of jobs) {
      await db.delete(jobLogs).where(eq(jobLogs.jobId, job.id));
    }
    await db.delete(postJobs).where(eq(postJobs.accountId, id));
    const dests = await db.select({ id: publishDestinations.id }).from(publishDestinations).where(eq(publishDestinations.socialAccountId, id)).all();
    for (const dest of dests) {
      await db.delete(groupDestinations).where(eq(groupDestinations.destinationId, dest.id));
    }
    await db.delete(publishDestinations).where(eq(publishDestinations.socialAccountId, id));
    await db.delete(accounts).where(eq(accounts.id, id));

    return new Response(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
