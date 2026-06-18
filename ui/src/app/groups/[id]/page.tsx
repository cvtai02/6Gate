"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getDestinationIconPath } from "@/lib/destination-icons";
import { TYPE_COLORS, TYPE_ABBR, TYPE_LABEL } from "@/lib/destination-types";

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

type QueueItem = {
  id: string;
  groupId: string;
  videoPath: string;
  title: string | null;
  caption: string | null;
  privacy: string | null;
  status: string;
  uploadBatchId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
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

const QUEUE_STATUS_META: Record<string, { dot: string; text: string }> = {
  Pending: { dot: "bg-yellow-400", text: "text-yellow-400" },
  Dispatched: { dot: "bg-green-400", text: "text-green-400" },
  Failed: { dot: "bg-red-400", text: "text-red-400" },
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

function DestAvatar({ type, avatarUrl, providerType, size = 8 }: { type: string; avatarUrl?: string | null; providerType?: string | null; size?: number }) {
  const [errored, setErrored] = useState(false);
  const cls = `w-${size} h-${size} rounded-lg object-cover shrink-0`;
  if (avatarUrl && !errored) {
    return <img src={avatarUrl} alt="" className={cls} onError={() => setErrored(true)} />;
  }
  return <DestBadge type={type} providerType={providerType} />;
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
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">&times;</button>
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
                        <span className="text-xs text-gray-500 shrink-0">Adding...</span>
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

/* ── Job Progress Panel ────────────────────────────────────────────────── */

function JobProgressPanel({ jobs, onReset }: { jobs: JobResult[]; onReset: () => void }) {
  const [liveJobs, setLiveJobs] = useState(jobs);

  useEffect(() => {
    setLiveJobs(jobs);
  }, [jobs]);

  useEffect(() => {
    const pending = liveJobs.filter((j) => (ACTIVE as readonly string[]).includes(j.status));
    if (pending.length === 0) return;
    const id = setInterval(async () => {
      const updated = await Promise.all(
        liveJobs.map(async (j) => {
          if ((TERMINAL as readonly string[]).includes(j.status) || j.status === "ReconnectRequired") return j;
          try {
            const res = await fetch(`/api/post-jobs/${j.id}`);
            if (!res.ok) return j;
            const data = await res.json();
            return { ...j, status: data.status as JobResult["status"], providerPostUrl: data.providerPostUrl ?? null, errorMessage: data.errorMessage ?? null };
          } catch { return j; }
        })
      );
      setLiveJobs(updated);
    }, 2000);
    return () => clearInterval(id);
  }, [liveJobs]);

  async function cancelJob(jobId: string) {
    try {
      await fetch(`/api/post-jobs/${jobId}/cancel`, { method: "POST" });
      setLiveJobs((cur) => cur.map((j) => j.id === jobId ? { ...j, status: "Cancelled" as const } : j));
    } catch { /* ignore */ }
  }

  const doneCount = liveJobs.filter((j) => (TERMINAL as readonly string[]).includes(j.status) || j.status === "ReconnectRequired").length;
  const allDone = doneCount === liveJobs.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{doneCount} / {liveJobs.length} done</span>
          {!allDone && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-400">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          )}
        </div>
        {allDone && (
          <button onClick={onReset} className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/60 px-3 py-1 rounded-lg transition-colors">
            Schedule another
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {liveJobs.map((j) => (
          <div key={j.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${JOB_STATUS_BORDER[j.status] ?? "border-white/10"}`}>
            <span className={`text-xs shrink-0 ${JOB_STATUS_COLOR[j.status]}`}>
              {j.status === "Published" ? "ok" : j.status === "Failed" || j.status === "Cancelled" ? "x" : j.status === "ReconnectRequired" ? "!" : "..."}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{j.destinationName}</p>
              {j.providerPostUrl && (
                <a href={j.providerPostUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline truncate block">View post</a>
              )}
              {j.errorMessage && <p className="text-xs text-red-400 truncate">{j.errorMessage}</p>}
            </div>
            <span className={`text-[10px] capitalize shrink-0 ${JOB_STATUS_COLOR[j.status]}`}>{j.status}</span>
            {(CANCELLABLE as readonly string[]).includes(j.status) && (
              <button onClick={() => cancelJob(j.id)} className="text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded border border-red-500/30 hover:border-red-400/50 transition-colors shrink-0">
                Cancel
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Schedule Video Form ───────────────────────────────────────────────── */

function ScheduleVideoForm({ groupId, hasDestinations, onQueued, onUploaded }: {
  groupId: string;
  hasDestinations: boolean;
  onQueued: () => void;
  onUploaded: (jobs: JobResult[]) => void;
}) {
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private" | "unlisted">("public");
  const [submitting, setSubmitting] = useState<"queue" | "upload" | null>(null);
  const [error, setError] = useState("");

  const hasInput = videoUrl.trim();

  function buildJsonBody(): string {
    return JSON.stringify({
      videoUrl: videoUrl.trim(),
      title: title.trim() || undefined,
      caption: caption.trim() || undefined,
      privacy,
    });
  }

  async function handleQueue(e: React.FormEvent) {
    e.preventDefault();
    if (!hasInput) return;
    setSubmitting("queue");
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: buildJsonBody(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      reset();
      onQueued();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to queue");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleUploadNow(e: React.FormEvent) {
    e.preventDefault();
    if (!hasInput) return;
    setSubmitting("upload");
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: buildJsonBody(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed");
      const jobs = ((data.jobs ?? []) as { id: string; destinationId: string; destinationName: string; platform: string }[]).map((j) => ({
        ...j,
        status: "Created" as const,
      }));
      onUploaded(jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(null);
    }
  }

  function reset() {
    setVideoUrl("");
    setTitle("");
    setCaption("");
    setPrivacy("public");
    setError("");
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Video URL input */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Video URL</label>
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://cdn.example.com/videos/clip.mp4"
          className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors font-mono"
        />
        <p className="text-[11px] text-gray-600 mt-1">Direct link to a video file hosted on a CDN or any public URL.</p>
      </div>

      {/* Metadata fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Title <span className="text-gray-600">(optional)</span></label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Video title"
            className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Privacy</label>
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {(["public", "unlisted", "private"] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setPrivacy(val)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  privacy === val
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                } ${val !== "public" ? "border-l border-[var(--border)]" : ""}`}
              >
                {val.charAt(0).toUpperCase() + val.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Caption <span className="text-gray-600">(optional)</span></label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption..."
          rows={2}
          className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors resize-none"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!hasInput || !hasDestinations || !!submitting}
          onClick={handleQueue}
          className="flex-1 py-2.5 text-sm font-medium border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 rounded-lg disabled:opacity-40 transition-colors"
        >
          {submitting === "queue" ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Adding...
            </span>
          ) : "Add to Queue"}
        </button>
        <button
          type="button"
          disabled={!hasInput || !hasDestinations || !!submitting}
          onClick={handleUploadNow}
          className="flex-1 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-40 transition-colors"
        >
          {submitting === "upload" ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Uploading...
            </span>
          ) : "Upload Now"}
        </button>
      </div>

      {!hasDestinations && (
        <p className="text-xs text-amber-400/80 text-center">Add destinations to this group before scheduling.</p>
      )}
    </div>
  );
}

/* ── Notification Channels ──────────────────────────────────────────────── */

type NotificationChannel = {
  id: string;
  accountId: string;
  chatId: string;
  chatName: string | null;
  botName: string | null;
  providerType: string;
};

type TelegramChat = {
  id: string;
  name: string;
  externalId: string | null;
  socialAccountId: string;
};

function AddNotificationChannelModal({
  groupId,
  telegramBots,
  onClose,
  onAdded,
}: {
  groupId: string;
  telegramBots: { id: string; displayName: string | null; username: string | null }[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [botId, setBotId] = useState(telegramBots[0]?.id ?? "");
  const [chats, setChats] = useState<TelegramChat[]>([]);
  const [selectedChat, setSelectedChat] = useState("");
  const [loadingChats, setLoadingChats] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!botId) { setChats([]); return; }
    setLoadingChats(true);
    setSelectedChat("");
    fetch(`/api/publish-destinations?type=telegram`)
      .then((r) => r.json())
      .then((all: TelegramChat[]) => {
        const botChats = all.filter((d) => d.socialAccountId === botId);
        setChats(botChats);
        if (botChats.length > 0) setSelectedChat(botChats[0].externalId ?? botChats[0].id);
      })
      .finally(() => setLoadingChats(false));
  }, [botId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!botId || !selectedChat) return;
    setSaving(true);
    setError("");
    const chat = chats.find((c) => (c.externalId ?? c.id) === selectedChat);
    const res = await fetch(`/api/groups/${groupId}/notification-channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: botId, chatId: selectedChat, chatName: chat?.name || undefined }),
    });
    if (res.ok) {
      onAdded();
      onClose();
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to add");
    }
    setSaving(false);
  }

  async function handleSyncChats() {
    if (!botId) return;
    setLoadingChats(true);
    setError("");
    try {
      const syncRes = await fetch(`/api/accounts/${botId}/sync`, { method: "POST" });
      const syncData = await syncRes.json();
      if (!syncRes.ok) {
        setError(syncData.message ?? syncData.error ?? "Sync failed");
      }
      const all: TelegramChat[] = await fetch(`/api/publish-destinations?type=telegram`).then((r) => r.json());
      const botChats = all.filter((d) => d.socialAccountId === botId);
      setChats(botChats);
      if (botChats.length > 0 && !selectedChat) setSelectedChat(botChats[0].externalId ?? botChats[0].id);
    } finally {
      setLoadingChats(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">Add Telegram Group</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
          {telegramBots.length === 0 ? (
            <p className="text-sm text-gray-500">No Telegram bots configured. Add one in <a href="/providers/telegram" className="text-indigo-400 hover:text-indigo-300">Providers → Telegram</a> first.</p>
          ) : (
            <>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Bot</label>
                <select
                  value={botId}
                  onChange={(e) => setBotId(e.target.value)}
                  className="w-full text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-white"
                >
                  {telegramBots.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.displayName || bot.username || bot.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-gray-500">Channel / Group</label>
                  <button
                    type="button"
                    onClick={handleSyncChats}
                    disabled={loadingChats}
                    className="text-[11px] text-sky-400 hover:text-sky-300 disabled:opacity-50"
                  >
                    {loadingChats ? "Syncing…" : "Sync chats"}
                  </button>
                </div>
                {loadingChats ? (
                  <div className="w-full text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-gray-500">
                    Loading…
                  </div>
                ) : chats.length === 0 ? (
                  <div className="w-full text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-gray-500">
                    No chats found — click "Sync chats" to discover groups the bot can access.
                  </div>
                ) : (
                  <select
                    required
                    value={selectedChat}
                    onChange={(e) => setSelectedChat(e.target.value)}
                    className="w-full text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-white"
                  >
                    {chats.map((chat) => (
                      <option key={chat.id} value={chat.externalId ?? chat.id}>
                        {chat.name} ({chat.externalId ?? chat.id})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[var(--border)] rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving || !selectedChat} className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors">
                  {saving ? "Adding…" : "Add"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function NotificationChannelsCard({
  groupId,
  channels,
  telegramBots,
  onChanged,
}: {
  groupId: string;
  channels: NotificationChannel[];
  telegramBots: { id: string; displayName: string | null; username: string | null }[];
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);

  async function removeChannel(channelId: string) {
    await fetch(`/api/groups/${groupId}/notification-channels/${channelId}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
      {showAdd && (
        <AddNotificationChannelModal
          groupId={groupId}
          telegramBots={telegramBots}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); onChanged(); }}
        />
      )}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wide">Telegram Group</h3>
        <button
          onClick={() => setShowAdd(true)}
          className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          + Add
        </button>
      </div>
      {channels.length === 0 ? (
        <div className="p-4 text-center">
          <p className="text-xs text-gray-500">No Telegram groups</p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 transition-colors"
          >
            + Add Group
          </button>
        </div>
      ) : (
        <div className="p-2 space-y-0.5">
          {channels.map((ch) => (
            <div key={ch.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[.03] group/notif">
              <div className="w-8 h-8 rounded-full bg-sky-600/30 border border-sky-500/30 flex items-center justify-center shrink-0">
                <img className="w-4 h-4" src="/icons/telegram.svg" alt="" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{ch.chatName || ch.chatId}</p>
                <p className="text-[11px] text-gray-600">
                  {ch.botName ?? "Bot"} · {ch.chatName ? ch.chatId : "Telegram"}
                </p>
              </div>
              <button
                onClick={() => removeChannel(ch.id)}
                className="text-[11px] text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover/notif:opacity-100 shrink-0"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function GroupOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [allDestinations, setAllDestinations] = useState<PublishDestination[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [nextUploadAt, setNextUploadAt] = useState<string | null>(null);
  const [uploadTimesInDay, setUploadTimesInDay] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [jobs, setJobs] = useState<JobResult[] | null>(null);
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>([]);
  const [telegramBots, setTelegramBots] = useState<{ id: string; displayName: string | null; username: string | null }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [groupRes, destRes, queueRes, settingsRes, nextRes, ncRes, accountsRes] = await Promise.all([
      fetch("/api/groups"),
      fetch("/api/publish-destinations"),
      fetch(`/api/groups/${id}/queue`),
      fetch(`/api/groups/${id}/queue-settings`),
      fetch(`/api/groups/${id}/next-upload-time`),
      fetch(`/api/groups/${id}/notification-channels`),
      fetch("/api/accounts"),
    ]);
    const groups: Group[] = await groupRes.json();
    setGroup(groups.find((g) => g.id === id) ?? null);
    setAllDestinations(await destRes.json());
    if (queueRes.ok) setQueueItems(await queueRes.json());
    if (settingsRes.ok) {
      const s = await settingsRes.json();
      setUploadTimesInDay(s.uploadTimesInDay ?? []);
    }
    if (nextRes.ok) {
      const n = await nextRes.json();
      setNextUploadAt(n.nextUploadAt ?? null);
    }
    if (ncRes.ok) setNotificationChannels(await ncRes.json());
    if (accountsRes.ok) {
      const allAccounts: { id: string; displayName: string | null; username: string | null; providerType: string }[] = await accountsRes.json();
      setTelegramBots(allAccounts.filter((a) => a.providerType === "telegram"));
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function removeDestination(destinationId: string) {
    await fetch(`/api/groups/${id}/destinations/${destinationId}`, { method: "DELETE" });
    await load();
  }

  async function removeQueueItem(itemId: string) {
    await fetch(`/api/groups/${id}/queue/${itemId}`, { method: "DELETE" });
    setQueueItems((prev) => prev.filter((x) => x.id !== itemId));
  }

  if (loading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] h-80" />
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] h-20" />
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] h-20" />
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] h-20" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-8"><p className="text-sm text-gray-500">Group not found.</p></div>
    );
  }

  const existingIds = new Set(group.destinations.map((d) => d.destinationId));
  const pendingItems = queueItems.filter((x) => x.status === "Pending");

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

      <div className="p-8 space-y-6 max-w-5xl">
        {/* Main content: 2-column */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* Left: Schedule form */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-white">Schedule a Video</h2>
              <p className="text-xs text-gray-500 mt-0.5">Upload a file or enter a storage path, then queue or publish immediately</p>
            </div>
            <div className="p-5">
              {jobs ? (
                <JobProgressPanel jobs={jobs} onReset={() => { setJobs(null); load(); }} />
              ) : (
                <ScheduleVideoForm
                  groupId={group.id}
                  hasDestinations={group.destinations.length > 0}
                  onQueued={load}
                  onUploaded={(j) => setJobs(j)}
                />
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Destinations */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wide">Destinations</h3>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  + Add
                </button>
              </div>
              {group.destinations.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-500">No destinations</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 transition-colors"
                  >
                    + Add Destination
                  </button>
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  {group.destinations.map((dest) => {
                    const type = dest.type ?? "";
                    return (
                      <div key={dest.destinationId} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[.03] group/dest">
                        <DestAvatar type={type} avatarUrl={dest.avatarUrl ?? dest.accountAvatarUrl} providerType={dest.providerType} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{dest.name}</p>
                          <p className="text-[11px] text-gray-600">{TYPE_LABEL[type] ?? type}</p>
                        </div>
                        <button
                          onClick={() => removeDestination(dest.destinationId)}
                          className="text-[11px] text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover/dest:opacity-100 shrink-0"
                        >
                          &times;
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Schedule info */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wide">Schedule</h3>
                <Link
                  href={`/groups/${id}/settings`}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Edit
                </Link>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-[11px] text-gray-500 mb-1">Daily upload times</p>
                  <p className="text-sm text-white">
                    {uploadTimesInDay.length > 0 ? [...uploadTimesInDay].sort().join("  ·  ") : "Not configured"}
                  </p>
                </div>
                {nextUploadAt && (
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">Next dispatch</p>
                    <p className="text-sm text-white">{new Date(nextUploadAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Notification Channels */}
            <NotificationChannelsCard
              groupId={id}
              channels={notificationChannels}
              telegramBots={telegramBots}
              onChanged={load}
            />
          </div>
        </div>

        {/* Pending Queue */}
        {pendingItems.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wide">Queue</h3>
                <span className="text-[11px] text-gray-500">{pendingItems.length} pending</span>
              </div>
              <Link
                href={`/groups/${id}/queue`}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {pendingItems.slice(0, 5).map((item) => {
                const meta = QUEUE_STATUS_META[item.status] ?? { dot: "bg-gray-400", text: "text-gray-400" };
                return (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.title || item.videoPath.split("/").pop()}</p>
                      <p className="text-[11px] text-gray-600 truncate">{item.videoPath}</p>
                    </div>
                    <span className="text-[11px] text-gray-600 shrink-0">{new Date(item.createdAt).toLocaleDateString()}</span>
                    <button
                      onClick={() => removeQueueItem(item.id)}
                      className="text-[11px] text-gray-600 hover:text-red-400 transition-colors shrink-0"
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
              {pendingItems.length > 5 && (
                <div className="px-5 py-2">
                  <Link href={`/groups/${id}/queue`} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                    +{pendingItems.length - 5} more...
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
