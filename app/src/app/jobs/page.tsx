import { getDb } from "@/server/db";
import { postJobs, publishDestinations, accounts } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";
import { JobsTable } from "./jobs-table";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const db = getDb();
  const jobs = await db
    .select({
      id: postJobs.id,
      platform: postJobs.platform,
      status: postJobs.status,
      title: postJobs.title,
      caption: postJobs.caption,
      providerPostUrl: postJobs.providerPostUrl,
      updatedAt: postJobs.updatedAt,
      destinationName: publishDestinations.name,
      destinationType: publishDestinations.type,
      destinationAvatar: publishDestinations.avatarUrl,
      accountAvatar: accounts.avatarUrl,
    })
    .from(postJobs)
    .leftJoin(publishDestinations, eq(postJobs.destinationId, publishDestinations.id))
    .leftJoin(accounts, eq(postJobs.accountId, accounts.id))
    .orderBy(desc(postJobs.updatedAt))
    .all();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Jobs</h1>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-10 text-center">
          <p className="text-gray-500 text-sm">No jobs yet.</p>
        </div>
      ) : (
        <JobsTable jobs={jobs} />
      )}
    </div>
  );
}
