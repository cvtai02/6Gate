"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

/* ── Types ─────────────────────────────────────────────────────────────── */

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

/* ── Status badge ───────────────────────────────────────────────────────── */

const STATUS_META: Record<string, { dot: string; text: string; border: string; bg: string }> = {
  Pending:    { dot: "bg-yellow-400", text: "text-yellow-400", border: "border-yellow-500/25",  bg: "bg-yellow-500/10"  },
  Dispatched: { dot: "bg-green-400",  text: "text-green-400",  border: "border-green-500/25",   bg: "bg-green-500/10"  },
  Failed:     { dot: "bg-red-400",    text: "text-red-400",    border: "border-red-500/25",      bg: "bg-red-500/10"    },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { dot: "bg-gray-400", text: "text-gray-400", border: "border-gray-500/25", bg: "bg-gray-500/10" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.bg} ${meta.text} ${meta.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {status}
    </span>
  );
}

/* ── Add to queue form ──────────────────────────────────────────────────── */

function AddToQueueForm({ groupId, onAdded }: { groupId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [storagePath, setStoragePath] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "unlisted" | "private">("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!storagePath.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/queue`, {
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
        setError(data.error ?? "Failed to add to queue");
      } else {
        setStoragePath("");
        setTitle("");
        setCaption("");
        setPrivacy("public");
        setOpen(false);
        onAdded();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-indigo-500/30 hover:border-indigo-500/60 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        + Add to Queue
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Add to Queue</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-gray-500 hover:text-gray-300 text-xs"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Storage Path</label>
          <input
            required
            autoFocus
            value={storagePath}
            onChange={(e) => setStoragePath(e.target.value)}
            placeholder="CloudflareR2/account/bucket/videos/clip.mp4"
            className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors font-mono"
          />
          <p className="text-[11px] text-gray-600 mt-1">7router absolute path. Dispatched at the next scheduled upload time.</p>
        </div>

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
            <select
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value as "public" | "unlisted" | "private")}
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Caption <span className="text-gray-600">(optional)</span></label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption…"
            rows={2}
            className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!storagePath.trim() || submitting}
            className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {submitting ? "Adding…" : "Add to Queue"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function GroupQueuePage() {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [nextUploadAt, setNextUploadAt] = useState<string | null>(null);
  const [uploadTimesInDay, setUploadTimesInDay] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  async function load() {
    try {
      const [queueRes, settingsRes, nextRes] = await Promise.all([
        fetch(`/api/groups/${id}/queue`),
        fetch(`/api/groups/${id}/queue-settings`),
        fetch(`/api/groups/${id}/next-upload-time`),
      ]);
      if (!queueRes.ok) throw new Error(`HTTP ${queueRes.status}`);
      setItems(await queueRes.json());
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setUploadTimesInDay(s.uploadTimesInDay ?? []);
      }
      if (nextRes.ok) {
        const n = await nextRes.json();
        setNextUploadAt(n.nextUploadAt ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleDelete(itemId: string) {
    setDeleting((prev) => new Set(prev).add(itemId));
    try {
      await fetch(`/api/groups/${id}/queue/${itemId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((x) => x.id !== itemId));
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  const pending = items.filter((x) => x.status === "Pending");
  const rest = items.filter((x) => x.status !== "Pending");

  return (
    <div className="p-8 max-w-3xl space-y-6">
      {/* Schedule info */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-5 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 mb-1">Daily upload times</p>
          <p className="text-sm font-semibold text-white">
            {uploadTimesInDay.length > 0 ? [...uploadTimesInDay].sort().join("  ·  ") : "—"}
          </p>
          {nextUploadAt && (
            <p className="text-xs text-gray-500 mt-1">
              Next dispatch: {new Date(nextUploadAt).toLocaleString()}
            </p>
          )}
        </div>
        <Link
          href={`/groups/${id}/settings`}
          className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/60 px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          Edit schedule
        </Link>
      </div>

      {/* Add to queue */}
      <AddToQueueForm groupId={id} onAdded={load} />

      {/* Queue items */}
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-10 text-center">
          <p className="text-sm text-gray-500">Queue is empty.</p>
          <p className="text-xs text-gray-600 mt-1">Added items will be dispatched at the scheduled upload time.</p>
        </div>
      )}

      {[...pending, ...rest].map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-5 py-4 flex items-start justify-between gap-4"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={item.status} />
              {item.title && <span className="text-sm font-medium text-white truncate">{item.title}</span>}
            </div>
            <p className="text-xs text-gray-500 font-mono truncate">{item.videoPath}</p>
            {item.errorMessage && (
              <p className="text-xs text-red-400">{item.errorMessage}</p>
            )}
            <p className="text-xs text-gray-700">Added {new Date(item.createdAt).toLocaleString()}</p>
          </div>

          {item.status === "Pending" && (
            <button
              type="button"
              disabled={deleting.has(item.id)}
              onClick={() => handleDelete(item.id)}
              className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-gray-400 hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-40"
            >
              {deleting.has(item.id) ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
