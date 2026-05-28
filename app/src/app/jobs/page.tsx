import { getDb } from "@/server/db";
import { postJobs } from "@/server/db/schema";
import { desc } from "drizzle-orm";
import { JobStatusBadge } from "@/components/job-status-badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const db = getDb();
  const jobs = await db
    .select()
    .from(postJobs)
    .orderBy(desc(postJobs.createdAt))
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
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-gray-500 text-xs">
                <th className="px-5 py-3 text-left">Job ID</th>
                <th className="px-5 py-3 text-left">Platform</th>
                <th className="px-5 py-3 text-left">Title</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Created</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-[var(--border)] last:border-0 hover:bg-white/[0.03]">
                  <td className="px-5 py-3 font-mono text-xs text-gray-400">
                    <Link href={`/jobs/${job.id}`} className="hover:text-white">
                      {job.id}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-300">{job.platform}</td>
                  <td className="px-5 py-3 text-gray-300 max-w-xs truncate">{job.title ?? "—"}</td>
                  <td className="px-5 py-3">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
