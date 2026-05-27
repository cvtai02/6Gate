import { getDb } from "@/server/db";
import { accounts, postJobs, providers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { JobStatusBadge } from "@/components/job-status-badge";
import { LiveLogView } from "@/components/live-log-view";
import { RetryButton } from "./retry-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const job = await db.select().from(postJobs).where(eq(postJobs.id, id)).get();
  if (!job) notFound();

  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, job.accountId))
    .get();

  const provider = account
    ? await db.select().from(providers).where(eq(providers.id, account.providerId)).get()
    : null;

  const fields = [
    { label: "Status", value: <JobStatusBadge status={job.status} /> },
    { label: "Platform", value: job.platform },
    { label: "Account", value: account?.displayName ?? account?.username ?? job.accountId },
    { label: "Provider", value: provider?.name ?? "—" },
    { label: "Video Path", value: <span className="font-mono text-xs">{job.videoPath}</span> },
    { label: "Title", value: job.title ?? "—" },
    { label: "Caption", value: job.caption ?? "—" },
    { label: "Privacy", value: job.privacy ?? "—" },
    ...(job.providerPostUrl ? [{ label: "Post URL", value: <a href={job.providerPostUrl} target="_blank" rel="noopener" className="text-indigo-400 hover:text-indigo-300 text-xs">{job.providerPostUrl}</a> }] : []),
    ...(job.errorMessage ? [{ label: "Error", value: <span className="text-red-400 text-xs">{job.errorMessage}</span> }] : []),
    { label: "Created", value: new Date(job.createdAt).toLocaleString() },
    { label: "Updated", value: new Date(job.updatedAt).toLocaleString() },
  ];

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/jobs" className="text-gray-500 hover:text-gray-300 text-sm">← Jobs</Link>
        <h1 className="text-xl font-bold text-white font-mono">{id}</h1>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Details</h2>
          <dl className="space-y-3">
            {fields.map(f => (
              <div key={f.label} className="flex justify-between gap-4 text-sm">
                <dt className="text-gray-500 shrink-0">{f.label}</dt>
                <dd className="text-gray-200 text-right">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col gap-4">
          {job.status === "failed" && (
            <RetryButton jobId={id} />
          )}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">cURL Example</h2>
            <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
              {`curl -N http://localhost:20129/api/post-jobs/${id}/events`}
            </pre>
          </div>
        </div>
      </div>

      <LiveLogView jobId={id} />
    </div>
  );
}
