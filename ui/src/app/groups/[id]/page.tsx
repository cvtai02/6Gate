"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getDestinationIconPath } from "@/lib/destination-icons";

/* ── Types ─────────────────────────────────────────────────────────────── */

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
  providerType: string | null;
  providerName: string | null;
  avatarUrl: string | null;
  accountUsername: string | null;
  accountAvatarUrl: string | null;
};

type JobResult = {
  id: string;
  destinationId: string;
  destinationName: string;
  platform: string;
  status:
    | "Created" | "Initializing" | "Uploading" | "Finishing"
    | "Processing" | "Retrying" | "Published" | "Failed"
    | "ReconnectRequired" | "Cancelled";
  providerPostUrl?: string | null;
  errorMessage?: string | null;
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

const TYPE_LABEL: Record<string, string> = {
  youtube_channel: "YouTube",
  facebook_page: "Facebook",
  tiktok_account: "TikTok",
  instagram_account: "Instagram",
  threads_profile: "Threads",
  TelegramChat: "Telegram",
};

const TYPE_ORDER = ["youtube_channel", "facebook_page", "instagram_account", "threads_profile", "tiktok_account", "TelegramChat"];

const TERMINAL = ["Published", "Failed", "Cancelled"] as const;
const ACTIVE = ["Created", "Initializing", "Uploading", "Finishing", "Processing", "Retrying"] as const;
const CANCELLABLE = ["Created", "Initializing", "Uploading", "Finishing", "Processing", "Retrying"] as const;

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

const JOB_STATUS_BORDER: Record<string, string> = {
  Created: "border-white/10 bg-white/[.03]",
  Initializing: "border-indigo-500/20 bg-indigo-500/5",
  Uploading: "border-indigo-500/20 bg-indigo-500/5",
  Finishing: "border-indigo-500/20 bg-indigo-500/5",
  Processing: "border-indigo-500/20 bg-indigo-500/5",
  Retrying: "border-amber-500/20 bg-amber-500/5",
  Published: "border-green-500/20 bg-green-500/5",
  Failed: "border-red-500/20 bg-red-500/5",
  ReconnectRequired: "border-orange-500/20 bg-orange-500/5",
  Cancelled: "border-white/10 bg-white/[.03]",
};

/* ── Visual helpers ─────────────────────────────────────────────────────── */

function DestBadge({ type, providerType }: { type: string; providerType?: string | null }) {
  const iconPath = getDestinationIconPath(type, providerType);
  if (iconPath) {
    return (
      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 p-1.5">
        <img src={iconPath} alt="" className="w-full h-full object-contain" />
      </div>
    );
  }
  const bg = TYPE_COLORS[type] ?? "bg-gray-700";
  const abbr = TYPE_ABBR[type] ?? type.slice(0, 2).toUpperCase();
  return (
    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
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
        className="w-8 h-8 rounded-lg object-cover shrink-0"
        onError={() => setErrored(true)}
      />
    );
  }
  return <DestBadge type={type} providerType={providerType} />;
}

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
              <span className="text-gray-400 block mt-1">Facebook</span> Visible to everyone.
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
              Only you can see it on all platforms.
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

/* ── Add Destination Modal ──────────────────────────────────────────────── */

function AddDestinationModal({
  groupId,
  existingIds,
  allDestinations,
  onClose,
  onAdded,
}: {
  groupId: string;
  existingIds: Set<string>;
  allDestinations: PublishDestination[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const available = allDestinations.filter((d) => !existingIds.has(d.id));

  const columns: { type: string; dests: PublishDestination[] }[] = [];
  for (const type of TYPE_ORDER) {
    const dests = available.filter((d) => d.type === type);
    if (dests.length > 0) columns.push({ type, dests });
  }
  const knownTypes = new Set(TYPE_ORDER);
  const extraTypes = [...new Set(available.filter((d) => !knownTypes.has(d.type)).map((d) => d.type))];
  for (const type of extraTypes) columns.push({ type, dests: available.filter((d) => d.type === type) });

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
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
                  <DestBadge type={type} />
                  <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                    {TYPE_LABEL[type] ?? type}
                  </span>
                  <span className="text-xs text-gray-600 ml-auto">{dests.length}</span>
                </div>
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

/* ── Upload panel ───────────────────────────────────────────────────────── */

function UploadPanel({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [storagePath, setStoragePath] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private" | "unlisted">("public");
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState<JobResult[] | null>(null);
  const [error, setError] = useState("");

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
            return { ...j, status: data.status as JobResult["status"], providerPostUrl: data.providerPostUrl ?? null, errorMessage: data.errorMessage ?? null };
          } catch { return j; }
        })
      );
      setJobs(updated);
    }, 2000);
    return () => clearInterval(id);
  }, [jobs]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!storagePath.trim()) return;
    setUploading(true);
    setError("");

    try {
      const res = await fetch(`/api/groups/${groupId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: storagePath.trim(),
          title: title.trim() || undefined,
          caption: caption.trim() || undefined,
          privacy,
        }),
      });
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

  async function cancelJob(jobId: string) {
    try {
      await fetch(`/api/post-jobs/${jobId}/cancel`, { method: "POST" });
      setJobs((cur) => cur?.map((j) => j.id === jobId ? { ...j, status: "Cancelled" as const } : j) ?? null);
    } catch { /* ignore */ }
  }

  function reset() {
    setJobs(null);
    setStoragePath("");
    setTitle("");
    setCaption("");
    setPrivacy("public");
    setError("");
  }

  const doneCount = jobs?.filter((j) => (TERMINAL as readonly string[]).includes(j.status) || j.status === "ReconnectRequired").length ?? 0;
  const allDone = jobs ? doneCount === jobs.length : false;

  if (jobs) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
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
          {allDone && (
            <button
              onClick={reset}
              className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/60 px-3 py-1 rounded-lg transition-colors"
            >
              Upload another
            </button>
          )}
        </div>

        <div className="space-y-2">
          {jobs.map((j) => (
            <div key={j.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${JOB_STATUS_BORDER[j.status] ?? "border-white/10"}`}>
              <span className={`text-xs mt-0.5 shrink-0 ${JOB_STATUS_COLOR[j.status]}`}>
                {j.status === "Published" ? "✓" : j.status === "Failed" || j.status === "Cancelled" ? "✕" : j.status === "ReconnectRequired" ? "⚠" : "·"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-white truncate">{j.destinationName}</p>
                  <span className={`text-[10px] capitalize shrink-0 ${JOB_STATUS_COLOR[j.status]}`}>
                    {j.status}
                  </span>
                </div>
                {j.providerPostUrl && (
                  <a href={j.providerPostUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline truncate block">
                    View post →
                  </a>
                )}
                {j.errorMessage && <p className="text-xs text-red-400 truncate">{j.errorMessage}</p>}
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
      </div>
    );
  }

  return (
    <form onSubmit={handleUpload} className="space-y-4">
      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Storage Path</label>
        <input
          required
          value={storagePath}
          onChange={(e) => setStoragePath(e.target.value)}
          placeholder="CloudflareR2/account/bucket/videos/clip.mp4"
          className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors font-mono"
        />
        <p className="text-[11px] text-gray-600 mt-1">7router absolute path to the video file in cloud storage.</p>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1.5">
          Title <span className="text-gray-600">(optional)</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Video title"
          className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1.5">
          Caption <span className="text-gray-600">(optional)</span>
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption…"
          rows={3}
          className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors resize-none"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Privacy</label>
        <PrivacyRadios privacy={privacy} setPrivacy={setPrivacy} />
      </div>

      <button
        type="submit"
        disabled={!storagePath.trim() || uploading}
        className="w-full py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors"
      >
        {uploading ? "Uploading…" : "Upload Now"}
      </button>
    </form>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function GroupOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [allDestinations, setAllDestinations] = useState<PublishDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  async function load() {
    setLoading(true);
    const [groupRes, destRes] = await Promise.all([
      fetch("/api/groups"),
      fetch("/api/publish-destinations"),
    ]);
    const groups: Group[] = await groupRes.json();
    const g = groups.find((g) => g.id === id) ?? null;
    setGroup(g);
    setAllDestinations(await destRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function removeDestination(destinationId: string) {
    await fetch(`/api/groups/${id}/destinations/${destinationId}`, { method: "DELETE" });
    await load();
  }

  if (loading) {
    return (
      <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] h-64" />
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] h-64" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Group not found.</p>
      </div>
    );
  }

  const existingIds = new Set(group.destinations.map((d) => d.destinationId));

  return (
    <>
      {showAddModal && (
        <AddDestinationModal
          groupId={group.id}
          existingIds={existingIds}
          allDestinations={allDestinations}
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); load(); }}
        />
      )}

      <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Destinations */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Destinations</h2>
              <p className="text-xs text-gray-500 mt-0.5">{group.destinations.length} platform{group.destinations.length !== 1 ? "s" : ""}</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/60 px-3 py-1.5 rounded-lg transition-colors"
            >
              + Add
            </button>
          </div>

          <div className="p-3 space-y-2">
            {group.destinations.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-500">No destinations yet</p>
                <p className="text-xs text-gray-600 mt-1">Add destinations to broadcast to multiple platforms</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/60 px-4 py-2 rounded-lg transition-colors"
                >
                  + Add Destination
                </button>
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
                      className="text-xs text-gray-600 hover:text-red-400 transition-colors shrink-0 px-2 py-1"
                      title="Remove from group"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Upload */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-white">Upload</h2>
            <p className="text-xs text-gray-500 mt-0.5">Publish immediately or schedule to all destinations</p>
          </div>

          <div className="p-5">
            {group.destinations.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Add destinations before uploading.</p>
            ) : (
              <UploadPanel groupId={group.id} groupName={group.name} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
