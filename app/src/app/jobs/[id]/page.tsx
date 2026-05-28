import { getDb } from "@/server/db";
import { accounts, postJobs, providers, publishDestinations, jobLogs } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { LiveLogView } from "@/components/live-log-view";
import { RetryButton } from "./retry-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, {
  label: string; dot: string; bg: string; text: string; border: string;
}> = {
  queued:    { label: "Queued",    dot: "bg-yellow-400",            bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/25" },
  running:   { label: "Running",   dot: "bg-blue-400 animate-pulse", bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/25"   },
  completed: { label: "Completed", dot: "bg-green-400",             bg: "bg-green-500/10",  text: "text-green-400",  border: "border-green-500/25"  },
  failed:    { label: "Failed",    dot: "bg-red-400",               bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/25"    },
};

const PLATFORM_CHIP: Record<string, string> = {
  youtube: "bg-red-600/20 text-red-400 border-red-500/30",
  meta:    "bg-blue-600/20 text-blue-400 border-blue-500/30",
  tiktok:  "bg-gray-600/20 text-gray-400 border-gray-500/30",
};
const PLATFORM_ABBR: Record<string, string> = {
  youtube: "YT", meta: "FB", tiktok: "TK",
};
const DEST_TYPE_LABEL: Record<string, string> = {
  youtube_channel:  "YouTube Channel",
  facebook_page:    "Facebook Page",
  tiktok_account:   "TikTok Account",
  instagram_account: "Instagram Account",
  threads_profile:  "Threads Profile",
};

function fmt(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const job = await db.select().from(postJobs).where(eq(postJobs.id, id)).get();
  if (!job) notFound();

  const [account, destination, logs] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.id, job.accountId)).get(),
    job.destinationId
      ? db.select().from(publishDestinations).where(eq(publishDestinations.id, job.destinationId)).get()
      : Promise.resolve(null),
    db.select().from(jobLogs).where(eq(jobLogs.jobId, id)).orderBy(jobLogs.createdAt).all(),
  ]);

  const provider = account
    ? await db.select().from(providers).where(eq(providers.id, account.providerId)).get()
    : null;

  const sm = STATUS_META[job.status] ?? STATUS_META.queued;
  const isDone = job.status === "completed" || job.status === "failed";
  const startedAt = logs[0]?.createdAt ?? null;
  const endedAt = isDone ? (logs[logs.length - 1]?.createdAt ?? job.updatedAt) : null;

  const details: { label: string; value: React.ReactNode }[] = [
    { label: "Title",       value: job.title ?? <span className="text-gray-600">—</span> },
    { label: "Account",     value: account?.displayName ?? account?.username ?? job.accountId },
    { label: "Destination", value: destination ? `${destination.name}  ·  ${DEST_TYPE_LABEL[destination.type] ?? destination.type}` : "—" },
    { label: "Provider",    value: provider?.name ?? "—" },
    { label: "Platform",    value: job.platform },
    { label: "Privacy",     value: job.privacy ?? "—" },
    { label: "Caption",     value: job.caption ?? <span className="text-gray-600">—</span> },
    { label: "Video file",  value: <span className="font-mono text-[11px] text-gray-500 break-all">{job.videoPath}</span> },
    { label: "Created",     value: <span className="font-mono text-xs text-gray-400">{fmt(job.createdAt)}</span> },
    { label: "Updated",     value: <span className="font-mono text-xs text-gray-400">{fmt(job.updatedAt)}</span> },
    ...(job.providerPostId ? [{ label: "Post ID", value: <span className="font-mono text-xs text-gray-400">{job.providerPostId}</span> }] : []),
  ];

  const timeline = [
    { label: "Queued",   time: job.createdAt, done: true },
    { label: "Started",  time: startedAt,      done: !!startedAt },
    { label: job.status === "failed" ? "Failed" : "Completed", time: endedAt, done: isDone },
  ];

  return (
    <div className="p-8 max-w-5xl space-y-6">

      {/* ── Back + title row ── */}
      <div>
        <Link href="/jobs" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-5 transition-colors">
          ← Jobs
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`shrink-0 text-xs font-bold font-mono px-2 py-1 rounded-md border ${PLATFORM_CHIP[job.platform] ?? "bg-gray-600/20 text-gray-400 border-gray-500/30"}`}>
              {PLATFORM_ABBR[job.platform] ?? job.platform.toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-white truncate">{job.title ?? "Untitled"}</h1>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">{id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${sm.bg} ${sm.text} ${sm.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
              {sm.label}
            </span>
            {job.status === "completed" && job.providerPostUrl && (
              <a
                href={job.providerPostUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                View Post ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Error alert ── */}
      {job.status === "failed" && job.errorMessage && (
        <div className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3.5">
          <span className="text-red-400 text-base leading-none mt-0.5 shrink-0">✕</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-400 mb-0.5">Job failed</p>
            <p className="text-xs text-red-300/70 break-words">{job.errorMessage}</p>
          </div>
        </div>
      )}

      {/* ── Details + sidebar ── */}
      <div className="grid grid-cols-5 gap-5">

        {/* Details card */}
        <div className="col-span-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
          <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-4">Details</h2>
          <dl className="space-y-3">
            {details.map(({ label, value }) => (
              <div key={label} className="flex gap-4 text-sm">
                <dt className="text-gray-500 w-24 shrink-0">{label}</dt>
                <dd className="text-gray-200 min-w-0">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Sidebar */}
        <div className="col-span-2 flex flex-col gap-4">
          {job.status === "failed" && <RetryButton jobId={id} />}

          {/* Timeline */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5 flex-1">
            <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-4">Timeline</h2>
            <ol className="space-y-4">
              {timeline.map(({ label, time, done }, i) => (
                <li key={label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] shrink-0 ${
                      done
                        ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                        : "border-gray-700 text-gray-700"
                    }`}>
                      {done ? "✓" : "·"}
                    </span>
                    {i < timeline.length - 1 && (
                      <span className="w-px flex-1 mt-1 bg-gray-800" />
                    )}
                  </div>
                  <div className="pb-1">
                    <p className={`text-xs font-medium ${done ? "text-gray-300" : "text-gray-600"}`}>{label}</p>
                    {time && (
                      <p className="text-[11px] text-gray-500 font-mono mt-0.5">{fmt(time)}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* ── Log terminal ── */}
      <LiveLogView jobId={id} initialLogs={logs} isLive={!isDone} />

    </div>
  );
}
