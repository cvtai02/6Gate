"use client";

import { useEffect, useState } from "react";
import { getDestinationIconPath } from "@/lib/destination-icons";

/* ── Types ──────────────────────────────────────────────────────────────── */

type GroupDestination = {
  destinationId: string;
  name: string | null;
  type: string | null;
  externalId: string | null;
  socialAccountId: string | null;
  providerType: string | null;
  providerName: string | null;
  avatarUrl: string | null;
  accountAvatarUrl: string | null;
};

type Group = {
  id: string;
  name: string;
  createdAt: string;
  destinations: GroupDestination[];
};

type PublishDestination = {
  id: string;
  name: string;
  type: string;
  externalId: string | null;
  socialAccountId: string;
  providerType: string | null;
  providerName: string | null;
  avatarUrl: string | null;
  accountUsername: string | null;
  accountAvatarUrl: string | null;
};

/* ── Type → visual mapping ───────────────────────────────────────────────── */

const TYPE_COLORS: Record<string, string> = {
  youtube_channel: "bg-red-600",
  facebook_page: "bg-blue-700",
  tiktok_account: "bg-gray-800",
  instagram_account: "bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400",
  threads_profile: "bg-black",
};

const TYPE_ABBR: Record<string, string> = {
  youtube_channel: "YT",
  facebook_page: "FB",
  tiktok_account: "TK",
  instagram_account: "IG",
  threads_profile: "TH",
};

const TYPE_LABEL: Record<string, string> = {
  youtube_channel: "YouTube",
  facebook_page: "Facebook",
  tiktok_account: "TikTok",
  instagram_account: "Instagram",
  threads_profile: "Threads",
};

const TYPE_ORDER = ["youtube_channel", "facebook_page", "instagram_account", "threads_profile", "tiktok_account"];

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

function DestAvatar({ type, avatarUrl, providerType }: { type: string; avatarUrl?: string | null; providerType?: string | null }) {
  const [errored, setErrored] = useState(false);
  if (avatarUrl && !errored) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="w-7 h-7 rounded-md object-cover shrink-0"
        onError={() => setErrored(true)}
      />
    );
  }
  return <DestBadge type={type} providerType={providerType} />;
}

/* ── Tooltip ─────────────────────────────────────────────────────────────── */

function Tooltip({ children, content, className = "" }: { children: React.ReactNode; content: React.ReactNode; className?: string }) {
  return (
    <span className={`relative group inline-flex items-center ${className}`}>
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-xs text-gray-300 leading-relaxed shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-normal">
        {content}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
      </span>
    </span>
  );
}

/* ── Upload Modal ────────────────────────────────────────────────────────── */

type JobResult = {
  id: string;
  destinationId: string;
  destinationName: string;
  platform: string;
  status:
    | "Created"
    | "Initializing"
    | "Uploading"
    | "Finishing"
    | "Processing"
    | "Retrying"
    | "Published"
    | "Failed"
    | "ReconnectRequired"
    | "Cancelled";
  providerPostUrl?: string | null;
  errorMessage?: string | null;
};

const TERMINAL = ["Published", "Failed", "Cancelled"] as const;
const ACTIVE = ["Created", "Initializing", "Uploading", "Finishing", "Processing", "Retrying"] as const;
const CANCELLABLE = ["Created", "Initializing", "Uploading", "Finishing", "Processing", "Retrying"] as const;

const JOB_STATUS_COLOR: Record<string, string> = {
  Created:           "text-gray-400",
  Initializing:      "text-indigo-400",
  Uploading:         "text-indigo-400",
  Finishing:         "text-indigo-400",
  Processing:        "text-indigo-400",
  Retrying:          "text-amber-400",
  Published:         "text-green-400",
  Failed:            "text-red-400",
  ReconnectRequired: "text-orange-400",
  Cancelled:         "text-gray-400",
};

const JOB_STATUS_BORDER: Record<string, string> = {
  Created:           "border-white/10 bg-white/[.03]",
  Initializing:      "border-indigo-500/20 bg-indigo-500/5",
  Uploading:         "border-indigo-500/20 bg-indigo-500/5",
  Finishing:         "border-indigo-500/20 bg-indigo-500/5",
  Processing:        "border-indigo-500/20 bg-indigo-500/5",
  Retrying:          "border-amber-500/20 bg-amber-500/5",
  Published:         "border-green-500/20 bg-green-500/5",
  Failed:            "border-red-500/20 bg-red-500/5",
  ReconnectRequired: "border-orange-500/20 bg-orange-500/5",
  Cancelled:         "border-white/10 bg-white/[.03]",
};

function PrivacyRadios({ privacy, setPrivacy }: { privacy: string; setPrivacy: (v: "public" | "private" | "unlisted") => void }) {
  return (
    <div className="flex gap-2">
      {(["public", "unlisted", "private"] as const).map((val) => {
        const tooltip =
          val === "public" ? (
            <span>
              <strong className="text-white block mb-1">Public</strong>
              <span className="text-gray-400 block">YouTube</span> Visible to everyone, searchable.
              <span className="text-gray-400 block mt-1">TikTok</span> Visible to everyone on the For You feed.
              <span className="text-gray-400 block mt-1">Facebook</span> Visible to everyone, including non-followers.
            </span>
          ) : val === "unlisted" ? (
            <span>
              <strong className="text-white block mb-1">Unlisted</strong>
              <span className="text-gray-400 block">YouTube</span> Only people with the link can watch.
              <span className="text-gray-400 block mt-1">TikTok</span> Not supported — falls back to Private.
              <span className="text-gray-400 block mt-1">Facebook</span> Not supported — falls back to Public.
            </span>
          ) : (
            <span>
              <strong className="text-white block mb-1">Private</strong>
              <span className="text-gray-400 block">YouTube</span> Only you can see it.
              <span className="text-gray-400 block mt-1">TikTok</span> Only you can see it.
              <span className="text-gray-400 block mt-1">Facebook</span> Only you can see it.
            </span>
          );

        const inner = (
          <label
            key={val}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border cursor-pointer text-xs font-medium transition-colors ${
              privacy === val
                ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                : "border-[var(--border)] text-gray-500 hover:border-gray-500 hover:text-gray-300"
            }`}
          >
            <input type="radio" name="privacy" value={val} checked={privacy === val} onChange={() => setPrivacy(val)} className="sr-only" />
            {val.charAt(0).toUpperCase() + val.slice(1)}
            <svg className="w-3 h-3 opacity-50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
            </svg>
          </label>
        );

        return <Tooltip key={val} content={tooltip} className="flex-1">{inner}</Tooltip>;
      })}
    </div>
  );
}

function UploadModal({ groupId, groupName, onClose }: { groupId: string; groupName: string; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private" | "unlisted">("public");
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState<JobResult[] | null>(null);
  const [error, setError] = useState("");

  // Create / revoke object URL for video preview
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Poll all pending jobs every 2s until all are terminal
  useEffect(() => {
    if (!jobs) return;
    const pending = jobs.filter((j) => (ACTIVE as readonly string[]).includes(j.status));
    if (pending.length === 0) return;

    const id = setInterval(async () => {
      const updated = await Promise.all(
        jobs.map(async (j) => {
          if ((TERMINAL as readonly string[]).includes(j.status) || j.status === "ReconnectRequired") return j;
          try {
            const res = await fetch(`/api/post-jobs/${j.id}`);
            if (!res.ok) return j;
            const data = await res.json();
            return {
              ...j,
              status: data.status as JobResult["status"],
              providerPostUrl: data.providerPostUrl ?? null,
              errorMessage: data.errorMessage ?? null,
            };
          } catch { return j; }
        })
      );
      setJobs(updated);
    }, 2000);

    return () => clearInterval(id);
  }, [jobs]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError("");

    const fd = new FormData();
    fd.append("video", file);
    if (title.trim()) fd.append("title", title.trim());
    if (caption.trim()) fd.append("caption", caption.trim());
    fd.append("privacy", privacy);

    try {
      const res = await fetch(`/api/groups/${groupId}/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
      } else {
        setJobs(
          (data.jobs ?? []).map((j: { id: string; destinationId: string; destinationName: string; platform: string }) => ({
            ...j,
            status: "Created" as const,
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const doneCount = jobs?.filter((j) => (TERMINAL as readonly string[]).includes(j.status) || j.status === "ReconnectRequired").length ?? 0;
  const allDone = jobs ? doneCount === jobs.length : false;

  async function cancelJob(jobId: string) {
    try {
      const res = await fetch(`/api/post-jobs/${jobId}/cancel`, { method: "POST" });
      if (!res.ok) return;
      setJobs((current) =>
        current?.map((job) =>
          job.id === jobId
            ? { ...job, status: "Cancelled", errorMessage: null }
            : job
        ) ?? null
      );
    } catch {
      /* polling will surface any persistent state */
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !uploading) onClose(); }}
    >
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl w-full max-w-3xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <h2 className="text-sm font-semibold text-white">Upload to {groupName}</h2>
          <button onClick={onClose} disabled={uploading} className="text-gray-400 hover:text-white text-lg leading-none disabled:opacity-40">✕</button>
        </div>

        {jobs ? (
          /* ── Jobs view ── */
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{doneCount} / {jobs.length} done</span>
              {!allDone && (
                <span className="flex items-center gap-1.5 text-xs text-indigo-400">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing…
                </span>
              )}
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {jobs.map((j) => (
                <div key={j.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${JOB_STATUS_BORDER[j.status] ?? "border-white/10"}`}>
                  <span className={`text-xs mt-0.5 shrink-0 tabular-nums ${JOB_STATUS_COLOR[j.status]}`}>
                    {j.status === "Published" ? "✓" : j.status === "Failed" ? "✕" : j.status === "Cancelled" ? "✕" : j.status === "ReconnectRequired" ? "⚠" : (ACTIVE as readonly string[]).includes(j.status) && j.status !== "Created" ? "▶" : "·"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white truncate">{j.destinationName}</p>
                      <span className={`text-[10px] capitalize shrink-0 ${JOB_STATUS_COLOR[j.status]}`}>{j.status}</span>
                    </div>
                    {j.providerPostUrl && (
                      <a href={j.providerPostUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline truncate block">
                        View post →
                      </a>
                    )}
                    {j.errorMessage && (
                      <p className="text-xs text-red-400 truncate">{j.errorMessage}</p>
                    )}
                  </div>
                  {(CANCELLABLE as readonly string[]).includes(j.status) && (
                    <button
                      type="button"
                      onClick={() => cancelJob(j.id)}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-md border border-red-500/30 hover:border-red-400/50 transition-colors shrink-0"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={onClose}
                className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
              >
                {allDone ? "Close" : "Close (jobs continue in background)"}
              </button>
            </div>
          </div>
        ) : (
          /* ── Upload form: two-column layout ── */
          <form onSubmit={handleUpload} className="flex gap-0 min-h-0">

            {/* Left — 9:16 video preview / drop zone */}
            <div className="p-5 flex items-center justify-center shrink-0" style={{ width: "280px" }}>
              <div
                className="relative rounded-xl overflow-hidden border border-[var(--border)] bg-black w-full"
                style={{ aspectRatio: "9/16" }}
              >
                {previewUrl ? (
                  <>
                    <video src={previewUrl} className="absolute inset-0 w-full h-full object-cover" controls playsInline />
                    <label className="absolute top-2 right-2 cursor-pointer bg-black/60 hover:bg-black/80 text-white text-[10px] px-2 py-1 rounded-md transition-colors">
                      Change
                      <input type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    </label>
                  </>
                ) : (
                  <label className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/5 transition-colors">
                    <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-xs text-gray-500 text-center px-3">Click to select video</span>
                    <span className="text-[10px] text-gray-700">9:16 · MP4, MOV…</span>
                    <input type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </label>
                )}
              </div>
            </div>

            {/* Right — metadata + actions */}
            <div className="flex-1 flex flex-col min-w-0 p-5 pl-0 gap-4">
              {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}

              {/* Filename chip when file selected */}
              {file && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-black/20">
                  <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                  <span className="text-xs text-gray-300 flex-1 truncate">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} className="text-gray-600 hover:text-gray-300 text-xs shrink-0">✕</button>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Title <span className="text-gray-600">(optional)</span></label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Video title"
                  className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
                />
              </div>

              {/* Caption */}
              <div className="flex-1 flex flex-col min-h-0">
                <label className="block text-xs text-gray-400 mb-1.5">Caption <span className="text-gray-600">(optional)</span></label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a caption…"
                  className="flex-1 min-h-[80px] w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Privacy */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Privacy</label>
                <PrivacyRadios privacy={privacy} setPrivacy={setPrivacy} />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={uploading}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[var(--border)] rounded-lg transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!file || uploading}
                  className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Create Group Modal ──────────────────────────────────────────────────── */

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed");
      } else {
        onCreated();
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">Create Group</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Group Name</label>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. All Platforms"
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[var(--border)] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Add Destination Modal ───────────────────────────────────────────────── */

function AddDestinationModal({
  groupId,
  existingDestinationIds,
  allDestinations,
  onClose,
  onAdded,
}: {
  groupId: string;
  existingDestinationIds: Set<string>;
  allDestinations: PublishDestination[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const available = allDestinations.filter((d) => !existingDestinationIds.has(d.id));

  // Group by type in a stable order
  const columns: { type: string; dests: PublishDestination[] }[] = [];
  for (const type of TYPE_ORDER) {
    const dests = available.filter((d) => d.type === type);
    if (dests.length > 0) columns.push({ type, dests });
  }
  // Any unknown types not in TYPE_ORDER
  const knownTypes = new Set(TYPE_ORDER);
  const extraTypes = [...new Set(available.filter((d) => !knownTypes.has(d.type)).map((d) => d.type))];
  for (const type of extraTypes) {
    columns.push({ type, dests: available.filter((d) => d.type === type) });
  }

  async function addDestination(destinationId: string) {
    setAdding(destinationId);
    await fetch(`/api/groups/${groupId}/destinations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinationId }),
    });
    setAdding(null);
    onAdded();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl w-full max-w-3xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">Add Destination</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        {available.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-10 px-6">All destinations are already in this group.</p>
        ) : (
          <div
            className="divide-x divide-[var(--border)]"
            style={{ display: "grid", gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}
          >
            {columns.map(({ type, dests }) => (
              <div key={type} className="flex flex-col">
                {/* Column header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
                  <DestBadge type={type} />
                  <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                    {TYPE_LABEL[type] ?? type}
                  </span>
                  <span className="text-xs text-gray-600 ml-auto">{dests.length}</span>
                </div>
                {/* Destination items */}
                <div className="p-2 space-y-0.5 max-h-72 overflow-y-auto">
                  {dests.map((dest) => (
                    <button
                      key={dest.id}
                      onClick={() => addDestination(dest.id)}
                      disabled={adding === dest.id}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors text-left disabled:opacity-50"
                    >
                      <DestAvatar type={dest.type} avatarUrl={dest.avatarUrl ?? dest.accountAvatarUrl} providerType={dest.providerType} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{dest.name}</p>
                        {dest.accountUsername && (
                          <p className="text-xs text-gray-500 truncate">@{dest.accountUsername}</p>
                        )}
                      </div>
                      {adding === dest.id ? (
                        <span className="text-xs text-gray-500 shrink-0">Adding…</span>
                      ) : (
                        <span className="text-xs text-indigo-500 shrink-0">+</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end px-6 py-3 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Group Card ──────────────────────────────────────────────────────────── */

function GroupCard({
  group,
  allDestinations,
  onDelete,
  onUpdate,
}: {
  group: Group;
  allDestinations: PublishDestination[];
  onDelete: () => void;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.name);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  async function saveName() {
    if (!draft.trim() || draft === group.name) { setEditing(false); return; }
    setSaving(true);
    await fetch(`/api/groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.trim() }),
    });
    setSaving(false);
    setEditing(false);
    onUpdate();
  }

  async function removeDestination(destinationId: string) {
    await fetch(`/api/groups/${group.id}/destinations/${destinationId}`, { method: "DELETE" });
    onUpdate();
  }

  async function copyGroupId() {
    await navigator.clipboard.writeText(group.id);
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1400);
  }

  const existingIds = new Set(group.destinations.map((d) => d.destinationId));

  return (
    <>
      {showAddModal && (
        <AddDestinationModal
          groupId={group.id}
          existingDestinationIds={existingIds}
          allDestinations={allDestinations}
          onClose={() => setShowAddModal(false)}
          onAdded={onUpdate}
        />
      )}
      {showUploadModal && (
        <UploadModal
          groupId={group.id}
          groupName={group.name}
          onClose={() => setShowUploadModal(false)}
        />
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          {editing ? (
            <div className="flex items-center gap-2 flex-1 mr-2">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") { setDraft(group.name); setEditing(false); }
                }}
                className="flex-1 bg-black/40 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
              />
              <button onClick={saveName} disabled={saving} className="text-xs text-indigo-400 hover:text-indigo-300">
                {saving ? "…" : "✓"}
              </button>
              <button
                onClick={() => { setDraft(group.name); setEditing(false); }}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white truncate">{group.name}</p>
                <button
                  onClick={() => { setDraft(group.name); setEditing(true); }}
                  className="text-gray-600 hover:text-gray-400 text-xs shrink-0"
                  title="Rename"
                >
                  ✏
                </button>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <code className="truncate text-[11px] text-gray-600">{group.id}</code>
                <button
                  onClick={copyGroupId}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 shrink-0"
                  title="Copy group ID"
                >
                  {copiedId ? "Copied" : "Copy ID"}
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowUploadModal(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-500/30 hover:border-indigo-500/60 transition-colors"
            >
              Upload
            </button>
            <button
              onClick={onDelete}
              className="text-xs text-red-400 hover:text-red-300 px-2.5 py-1 rounded-lg border border-red-500/30 hover:border-red-400/50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Destinations */}
        <div className="p-3 space-y-2">
          {group.destinations.length === 0 ? (
            <div className="py-5 text-center">
              <p className="text-sm text-gray-500">No destinations in this group</p>
              <p className="text-xs text-gray-600 mt-0.5">Add destinations to post to multiple platforms at once</p>
            </div>
          ) : (
            group.destinations.map((dest) => {
              const type = dest.type ?? "";
              return (
                <div
                  key={dest.destinationId}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-black/20"
                >
                  <DestAvatar type={type} avatarUrl={dest.avatarUrl ?? dest.accountAvatarUrl} providerType={dest.providerType} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{dest.name}</p>
                    <p className="text-xs text-gray-500">{TYPE_LABEL[type] ?? type}</p>
                  </div>
                  <button
                    onClick={() => removeDestination(dest.destinationId)}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors shrink-0"
                    title="Remove from group"
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-indigo-400 hover:text-indigo-300 border border-dashed border-indigo-500/30 hover:border-indigo-500/60 rounded-lg transition-colors"
          >
            + Add Destination
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

function GroupCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden animate-pulse">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="h-4 w-28 bg-white/10 rounded-md" />
        <div className="h-6 w-16 bg-white/5 rounded-lg" />
      </div>
      <div className="p-3 space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-black/20">
            <div className="w-7 h-7 rounded-md bg-white/10 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 bg-white/10 rounded" />
              <div className="h-2.5 w-1/3 bg-white/5 rounded" />
            </div>
          </div>
        ))}
        <div className="h-8 w-full bg-white/5 rounded-lg border border-dashed border-white/10" />
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [allDestinations, setAllDestinations] = useState<PublishDestination[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [groupRes, destRes] = await Promise.all([
      fetch("/api/groups"),
      fetch("/api/publish-destinations"),
    ]);
    setGroups(await groupRes.json());
    setAllDestinations(await destRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this group?")) return;
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="p-8 flex flex-col gap-6 min-h-full">
      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Groups</h1>
          <p className="text-sm text-gray-500 mt-1">Group destinations to post to multiple platforms at once</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + Create Group
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <GroupCardSkeleton key={i} />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--border)] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-white font-medium">No groups yet</p>
          <p className="text-sm text-gray-500 mt-1">Create a group to post to multiple destinations at once.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Create Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              allDestinations={allDestinations}
              onDelete={() => handleDelete(group.id)}
              onUpdate={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
