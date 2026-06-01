"use client";

import { useRouter } from "next/navigation";
import { JobStatusBadge } from "@/components/job-status-badge";
import { getDestinationIconPath } from "@/lib/destination-icons";

const DEST_TYPE_LABEL: Record<string, string> = {
  youtube_channel: "YouTube Channel",
  facebook_page: "Facebook Page",
  tiktok_account: "TikTok Account",
  instagram_account: "Instagram Account",
  threads_profile: "Threads Profile",
};

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
  updatedAt: string;
  destinationName: string | null;
  destinationType: string | null;
  destinationAvatar: string | null;
  accountAvatar: string | null;
};

export function JobsTable({ jobs }: { jobs: Job[] }) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-gray-500 text-xs">
            <th className="px-5 py-3 text-left">Destination</th>
            <th className="px-5 py-3 text-left">Title</th>
            <th className="px-5 py-3 text-left">Caption</th>
            <th className="px-5 py-3 text-left">Status</th>
            <th className="px-5 py-3 text-left">Last Changed</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const destinationIcon = getDestinationIconPath(job.destinationType, job.platform);
            return (
            <tr
              key={job.id}
              className="border-b border-[var(--border)] last:border-0 hover:bg-white/[0.03] cursor-pointer"
              onClick={() => router.push(`/jobs/${job.id}`)}
            >
              <td className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  {(job.destinationAvatar ?? job.accountAvatar) ? (
                    <img
                      src={(job.destinationAvatar ?? job.accountAvatar)!}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover shrink-0 bg-gray-700"
                    />
                  ) : destinationIcon ? (
                    <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0 p-1.5">
                      <img src={destinationIcon} alt="" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center shrink-0 text-[10px] font-semibold text-gray-400 uppercase">
                      {(job.destinationName ?? job.platform).slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <div className="text-gray-300 text-sm leading-snug">
                      {job.destinationName ?? job.platform}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {job.destinationType
                        ? (DEST_TYPE_LABEL[job.destinationType] ?? job.destinationType)
                        : job.platform}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3">
                <div className="max-w-[200px] truncate text-gray-300">{job.title ?? "—"}</div>
              </td>
              <td className="px-5 py-3">
                <div className="max-w-[240px] truncate text-gray-400 text-xs">{job.caption ?? "—"}</div>
              </td>
              <td className="px-5 py-3">
                {job.status === "Created" && job.scheduledAt ? (
                  <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
                    Scheduled
                  </span>
                ) : job.status === "Published" && job.providerPostUrl ? (
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
                ) : (
                  <JobStatusBadge status={job.status} />
                )}
              </td>
              <td
                className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap"
                title={job.scheduledAt && job.status === "Created" ? `Scheduled for ${new Date(job.scheduledAt).toLocaleString()}` : new Date(job.updatedAt).toLocaleString()}
              >
                {job.scheduledAt && job.status === "Created" ? new Date(job.scheduledAt).toLocaleString() : timeAgo(job.updatedAt)}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
