"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getDestinationIconPath } from "@/lib/destination-icons";

/* ── Types ─────────────────────────────────────────────────────────────── */

type HistoryJob = {
  id: string;
  status: string;
  providerPostUrl: string | null;
  errorMessage: string | null;
  updatedAt: string;
  destinationName: string | null;
  destinationType: string | null;
  destinationAvatar: string | null;
  accountAvatar: string | null;
  providerType: string | null;
  destinationIcon: string | null;
};

type HistoryBatch = {
  id: string;
  title: string | null;
  caption: string | null;
  privacy: string | null;
  videoPath: string | null;
  createdAt: string;
  updatedAt: string;
  jobs: HistoryJob[];
};

/* ── Constants ──────────────────────────────────────────────────────────── */

const TYPE_COLORS: Record<string, string> = {
  youtube_channel: "bg-red-600",
  facebook_page: "bg-blue-700",
  tiktok_account: "bg-gray-800",
  instagram_account: "bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400",
  threads_profile: "bg-black",
  TelegramChat: "bg-sky-500",
};

const TYPE_ABBR: Record<string, string> = {
  youtube_channel: "YT",
  facebook_page: "FB",
  tiktok_account: "TK",
  instagram_account: "IG",
  threads_profile: "TH",
  TelegramChat: "TG",
};

const JOB_STATUS_COLOR: Record<string, string> = {
  Created: "text-gray-400",
  Initializing: "text-indigo-400",
  Uploading: "text-indigo-400",
  Finishing: "text-indigo-400",
  Processing: "text-indigo-400",
  Retrying: "text-amber-400",
  Published: "text-green-400",
  Failed: "text-red-400",
  ReconnectRequired: "text-orange-400",
  Cancelled: "text-gray-400",
};

/* ── Helpers ────────────────────────────────────────────────────────────── */

function DestBadge({ type, providerType }: { type: string; providerType?: string | null }) {
  const iconPath = getDestinationIconPath(type, providerType);
  if (iconPath) {
    return (
      <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shrink-0 p-1.5">
        <img src={iconPath} alt="" className="w-full h-full object-contain" />
      </div>
    );
  }
  const bg = TYPE_COLORS[type] ?? "bg-gray-700";
  const abbr = TYPE_ABBR[type] ?? type.slice(0, 2).toUpperCase();
  return (
    <div className={`w-7 h-7 rounded-md ${bg} flex items-center justify-center shrink-0`}>
      <span className="text-[10px] font-bold text-white">{abbr}</span>
    </div>
  );
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function batchSummary(batch: HistoryBatch): string {
  const counts = batch.jobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1;
    return acc;
  }, {});
  const active = (counts.Uploading ?? 0) + (counts.Processing ?? 0) + (counts.Finishing ?? 0) + (counts.Initializing ?? 0);
  return [
    counts.Published ? `${counts.Published} published` : "",
    counts.Failed ? `${counts.Failed} failed` : "",
    counts.Cancelled ? `${counts.Cancelled} cancelled` : "",
    counts.Created ? `${counts.Created} queued` : "",
    active ? `${active} active` : "",
  ].filter(Boolean).join(", ") || `${batch.jobs.length} job${batch.jobs.length === 1 ? "" : "s"}`;
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function GroupHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [batches, setBatches] = useState<HistoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/groups/${id}/history`);
        const data = await res.json();
        if (!res.ok) setError(data.error ?? "Failed to load history");
        else if (!cancelled) setBatches(data.batches ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="p-8 max-w-4xl space-y-4">
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-[var(--border)] bg-[var(--muted)]" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</p>
      ) : batches.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-14 text-center">
          <p className="text-white font-medium">No history yet</p>
          <p className="text-sm text-gray-500 mt-1">Uploads to this group will appear here.</p>
        </div>
      ) : (
        batches.map((batch) => (
          <div key={batch.id} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{batch.title || "Untitled upload"}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Uploaded {formatDateTime(batch.createdAt)}
                </p>
                {batch.caption && (
                  <p className="text-xs text-gray-400 mt-1 truncate">{batch.caption}</p>
                )}
              </div>
              <span className="text-xs text-gray-500 shrink-0 mt-0.5">{batchSummary(batch)}</span>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {batch.jobs.map((job) => {
                const iconPath = job.destinationIcon ?? getDestinationIconPath(job.destinationType, job.providerType);
                return (
                  <a
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors"
                  >
                    {(job.destinationAvatar ?? job.accountAvatar) ? (
                      <img
                        src={(job.destinationAvatar ?? job.accountAvatar)!}
                        alt=""
                        className="w-7 h-7 rounded-md object-cover shrink-0"
                      />
                    ) : iconPath ? (
                      <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shrink-0 p-1.5">
                        <img src={iconPath} alt="" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <DestBadge type={job.destinationType ?? ""} providerType={job.providerType} />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{job.destinationName ?? "Destination"}</p>
                      {job.errorMessage && (
                        <p className="text-xs text-red-400 truncate">{job.errorMessage}</p>
                      )}
                    </div>

                    <span className={`text-xs shrink-0 ${JOB_STATUS_COLOR[job.status] ?? "text-gray-400"}`}>
                      {job.status}
                    </span>

                    {job.providerPostUrl && (
                      <span
                        onClick={(e) => {
                          e.preventDefault();
                          window.open(job.providerPostUrl!, "_blank", "noopener,noreferrer");
                        }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 shrink-0"
                      >
                        View
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
