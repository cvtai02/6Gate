"use client";

import { useRouter } from "next/navigation";
import { JobStatusBadge } from "@/components/job-status-badge";
import { getDestinationIconPath } from "@/lib/destination-icons";
import { DEST_TYPE_LABEL } from "@/lib/destination-types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(Math.abs(diff) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

type Job = {
  id: string;
  platform: string;
  status: string;
  title: string | null;
  caption: string | null;
  providerPostUrl: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  uploadBatchId: string | null;
  groupId: string | null;
  groupName: string | null;
  destinationName: string | null;
  destinationType: string | null;
  destinationAvatar: string | null;
  accountAvatar: string | null;
};

type Batch = {
  batchId: string;
  groupName: string | null;
  groupId: string | null;
  title: string | null;
  createdAt: string;
  jobs: Job[];
};

function groupIntoBatches(jobs: Job[]): Batch[] {
  const batchMap = new Map<string, Job[]>();
  const ungrouped: Job[] = [];

  for (const job of jobs) {
    if (job.uploadBatchId) {
      const list = batchMap.get(job.uploadBatchId) ?? [];
      list.push(job);
      batchMap.set(job.uploadBatchId, list);
    } else {
      ungrouped.push(job);
    }
  }

  const batches: Batch[] = [];
  for (const [batchId, batchJobs] of batchMap) {
    const first = batchJobs[0];
    batches.push({
      batchId,
      groupName: first.groupName,
      groupId: first.groupId,
      title: first.title,
      createdAt: first.createdAt,
      jobs: batchJobs,
    });
  }

  for (const job of ungrouped) {
    batches.push({
      batchId: job.id,
      groupName: job.groupName,
      groupId: job.groupId,
      title: job.title,
      createdAt: job.createdAt,
      jobs: [job],
    });
  }

  batches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return batches;
}

function batchStatus(jobs: Job[]): string {
  if (jobs.every((j) => j.status === "Published")) return "Published";
  if (jobs.some((j) => j.status === "Failed")) return "Failed";
  if (jobs.some((j) => j.status === "Uploading")) return "Uploading";
  if (jobs.some((j) => j.status === "Cancelled")) return "Cancelled";
  if (jobs.every((j) => j.status === "Created" && j.scheduledAt)) return "Scheduled";
  return "Created";
}

function DestinationCell({ job }: { job: Job }) {
  const destinationIcon = getDestinationIconPath(job.destinationType, job.platform);
  return (
    <div className="flex items-center gap-2">
      {(job.destinationAvatar ?? job.accountAvatar) ? (
        <img
          src={(job.destinationAvatar ?? job.accountAvatar)!}
          alt=""
          className="w-6 h-6 rounded-full object-cover shrink-0 bg-gray-700"
        />
      ) : destinationIcon ? (
        <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 p-1">
          <img src={destinationIcon} alt="" className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center shrink-0 text-[9px] font-semibold text-gray-400 uppercase">
          {(job.destinationName ?? job.platform).slice(0, 2)}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-gray-300 text-xs leading-snug truncate">
          {job.destinationName ?? job.platform}
        </div>
        <div className="text-gray-600 text-[10px]">
          {job.destinationType ? (DEST_TYPE_LABEL[job.destinationType] ?? job.destinationType) : job.platform}
        </div>
      </div>
    </div>
  );
}

function JobStatusCell({ job }: { job: Job }) {
  if (job.status === "Created" && job.scheduledAt) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
        Scheduled
      </span>
    );
  }
  if (job.status === "Published" && job.providerPostUrl) {
    return (
      <a
        href={job.providerPostUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex hover:opacity-80 transition-opacity"
        title="View post"
        onClick={(e) => e.stopPropagation()}
      >
        <JobStatusBadge status={job.status} />
      </a>
    );
  }
  return <JobStatusBadge status={job.status} />;
}

export function JobsTable({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const batches = groupIntoBatches(jobs);

  return (
    <div className="space-y-4">
      {batches.map((batch) => {
        const status = batchStatus(batch.jobs);
        const isScheduled = batch.jobs.some((j) => j.scheduledAt && j.status === "Created");
        return (
          <div
            key={batch.batchId}
            className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden"
          >
            {/* Batch header */}
            <div
              className="px-5 py-3 flex items-center justify-between gap-4 border-b border-[var(--border)] hover:bg-white/[0.03] cursor-pointer"
              onClick={() => {
                const id = batch.jobs.length === 1 && !batch.jobs[0].uploadBatchId
                  ? null
                  : batch.batchId;
                if (id) router.push(`/jobs/batch/${id}`);
                else router.push(`/jobs/${batch.jobs[0].id}`);
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <JobStatusBadge status={status} />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-white truncate block">
                    {batch.title ?? "Untitled"}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    {batch.groupName && (
                      <span
                        className="text-indigo-400/80 hover:text-indigo-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (batch.groupId) router.push(`/groups/${batch.groupId}`);
                        }}
                      >
                        {batch.groupName}
                      </span>
                    )}
                    <span>·</span>
                    <span>{batch.jobs.length} destination{batch.jobs.length !== 1 ? "s" : ""}</span>
                    {isScheduled && (
                      <>
                        <span>·</span>
                        <span className="text-amber-400/70">Scheduled</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-600 shrink-0" title={new Date(batch.createdAt).toLocaleString()}>
                {timeAgo(batch.createdAt)}
              </span>
            </div>

            {/* Job rows */}
            <div>
              {batch.jobs.map((job) => (
                <div
                  key={job.id}
                  className="px-5 py-2.5 flex items-center gap-4 border-b border-[var(--border)] last:border-0 hover:bg-white/[0.03] cursor-pointer"
                  onClick={() => router.push(`/jobs/${job.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <DestinationCell job={job} />
                  </div>
                  <div className="shrink-0">
                    <JobStatusCell job={job} />
                  </div>
                  <span className="text-[10px] text-gray-600 shrink-0 w-16 text-right" title={new Date(job.updatedAt).toLocaleString()}>
                    {timeAgo(job.updatedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
