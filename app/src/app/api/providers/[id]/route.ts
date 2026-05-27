import { getDb } from "@/server/db";
import { providers, accounts, postJobs, jobLogs } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const row = await db.select().from(providers).where(eq(providers.id, id)).get();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(row);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDb();
    const row = await db.select().from(providers).where(eq(providers.id, id)).get();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });

    const updates: Record<string, string | null> = {};
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
    if (typeof body.clientId === "string" && body.clientId.trim()) updates.clientId = body.clientId.trim();
    if (typeof body.clientSecret === "string" && body.clientSecret.trim()) updates.clientSecret = body.clientSecret.trim();
    if (typeof body.scopes === "string") updates.scopes = body.scopes.trim() || null;
    if (Array.isArray(body.scopes)) updates.scopes = body.scopes.join(",") || null;

    if (Object.keys(updates).length > 0) {
      await db.update(providers).set(updates).where(eq(providers.id, id));
    }
    const updated = await db.select().from(providers).where(eq(providers.id, id)).get();
    return Response.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = await db.select().from(providers).where(eq(providers.id, id)).get();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });

    // Cascade: delete job_logs → post_jobs → accounts → provider
    const providerAccounts = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.providerId, id)).all();
    for (const acc of providerAccounts) {
      const jobs = await db.select({ id: postJobs.id }).from(postJobs).where(eq(postJobs.accountId, acc.id)).all();
      for (const job of jobs) {
        await db.delete(jobLogs).where(eq(jobLogs.jobId, job.id));
      }
      await db.delete(postJobs).where(eq(postJobs.accountId, acc.id));
    }
    await db.delete(accounts).where(eq(accounts.providerId, id));
    await db.delete(providers).where(eq(providers.id, id));

    return new Response(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
