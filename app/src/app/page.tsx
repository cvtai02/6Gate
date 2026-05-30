import { getDb } from "@/server/db";
import { accounts, postJobs, providers } from "@/server/db/schema";
import { desc } from "drizzle-orm";
import { JobStatusBadge } from "@/components/job-status-badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getStats() {
  const db = getDb();
  const [allJobs, allAccounts, allProviders] = await Promise.all([
    db.select().from(postJobs).orderBy(desc(postJobs.createdAt)).all(),
    db.select().from(accounts).all(),
    db.select().from(providers).all(),
  ]);

  return {
    accounts: allAccounts.length,
    providers: allProviders.length,
    pending: allJobs.filter((j) => j.status === "Created").length,
    running: allJobs.filter((j) => ["Initializing", "Uploading", "Finishing", "Processing", "Retrying"].includes(j.status)).length,
    failed: allJobs.filter((j) => j.status === "Failed" || j.status === "ReconnectRequired").length,
    completed: allJobs.filter((j) => j.status === "Published").length,
    recent: allJobs.slice(0, 8),
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  const cards = [
    { label: "Providers", value: stats.providers, href: "/providers", color: "text-purple-400" },
    { label: "Connections", value: stats.accounts, href: "/providers", color: "text-indigo-400" },
    { label: "Queued", value: stats.pending, href: "/jobs", color: "text-yellow-400" },
    { label: "Running", value: stats.running, href: "/jobs", color: "text-blue-400" },
    { label: "Failed", value: stats.failed, href: "/jobs", color: "text-red-400" },
    { label: "Completed", value: stats.completed, href: "/jobs", color: "text-green-400" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">6Gate running on localhost:20129</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5 hover:border-indigo-500/50 transition-colors"
          >
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </Link>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Recent Jobs</h2>
          <Link href="/jobs" className="text-xs text-indigo-400 hover:text-indigo-300">
            View all →
          </Link>
        </div>

        {stats.recent.length === 0 ? (
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
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((job) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
