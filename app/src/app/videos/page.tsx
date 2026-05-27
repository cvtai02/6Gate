"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* ── Types ──────────────────────────────────────────────────────────────── */

type VideoFolder = {
  id: string;
  path: string;
  label: string;
  createdAt: string;
};

type VideoEntry = {
  name: string;
  path: string;
  size: number;
  sizeLabel: string;
  mtime: string;
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function videoUrl(p: string) {
  return `/api/videos/file?path=${encodeURIComponent(p)}`;
}

/* ── Playback modal ──────────────────────────────────────────────────────── */

function VideoModal({ entry, onClose }: { entry: VideoEntry; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl overflow-hidden w-full max-w-4xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
          <p className="text-sm text-white font-medium truncate">{entry.name}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white ml-4 text-lg leading-none">✕</button>
        </div>
        <video src={videoUrl(entry.path)} controls autoPlay className="w-full max-h-[72vh] bg-black" />
        <div className="px-5 py-3 text-xs text-gray-500">{entry.sizeLabel} · {entry.name}</div>
      </div>
    </div>
  );
}

/* ── Add Folder modal ────────────────────────────────────────────────────── */

function AddFolderModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!folderPath.trim()) { setError("Folder path is required"); return; }
    if (!label.trim()) { setError("Name is required"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/video-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath.trim(), label: label.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      onConfirm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">Add Folder</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Name</label>
            <input
              autoFocus
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. My Videos"
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Folder path</label>
            <input
              required
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder={String.raw`e.g. C:\Users\You\Videos`}
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[var(--border)] rounded-lg transition-colors"
            >Cancel</button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors"
            >{submitting ? "Saving…" : "Add Folder"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── VideoCard ───────────────────────────────────────────────────────────── */

function VideoCard({
  entry,
  onWatch,
  onUpload,
  onRefresh,
}: {
  entry: VideoEntry;
  onWatch: () => void;
  onUpload: () => void;
  onRefresh: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(entry.name);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [menuOpen]);

  async function saveRename() {
    const newName = draft.trim();
    if (!newName || newName === entry.name) { setRenaming(false); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: entry.path, newName }),
      });
      if (!res.ok) { const d = await res.json(); alert("Rename failed: " + d.error); }
      else onRefresh();
    } catch (e) { alert("Rename failed: " + (e instanceof Error ? e.message : e)); }
    setBusy(false);
    setRenaming(false);
  }

  async function doDelete() {
    setMenuOpen(false);
    if (!confirm(`Permanently delete "${entry.name}"?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/videos?path=${encodeURIComponent(entry.path)}`, { method: "DELETE" });
      onRefresh();
    } catch (e) { alert("Delete failed: " + (e instanceof Error ? e.message : e)); }
    setBusy(false);
  }

  return (
    <div className={`relative rounded-xl overflow-hidden break-inside-avoid mb-4 group bg-black/30 ${busy ? "opacity-40 pointer-events-none" : ""}`}>
      <video
        src={`${videoUrl(entry.path)}#t=0.5`}
        preload="metadata"
        muted
        playsInline
        className="w-full block cursor-pointer"
        onClick={onWatch}
      />

      <button
        onClick={onWatch}
        className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
      >
        <svg className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
        </svg>
      </button>

      <div ref={menuRef} className="absolute top-3 right-3">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
          className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
        >
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-10 w-40 bg-[#1a1a24] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden z-20 text-sm">
            <button
              onClick={() => { setMenuOpen(false); setDraft(entry.name); setRenaming(true); }}
              className="w-full text-left px-4 py-2.5 text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
            >Rename</button>
            <button
              onClick={doDelete}
              className="w-full text-left px-4 py-2.5 text-red-400 hover:bg-red-500/10 transition-colors"
            >Delete</button>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200">
        {renaming ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") { setDraft(entry.name); setRenaming(false); }
              }}
              className="flex-1 bg-black/60 border border-indigo-500 rounded-lg px-2 py-1 text-xs text-white focus:outline-none min-w-0"
              onClick={(e) => e.stopPropagation()}
            />
            <button onClick={saveRename} className="text-xs text-indigo-400 shrink-0">✓</button>
            <button onClick={() => { setDraft(entry.name); setRenaming(false); }} className="text-xs text-gray-400 shrink-0">✕</button>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-white truncate leading-snug mb-1.5">{entry.name}</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400">{entry.sizeLabel}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onUpload(); }}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg transition-colors shrink-0"
              >Upload</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function VideosPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<VideoFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [watching, setWatching] = useState<VideoEntry | null>(null);
  const [showAddFolder, setShowAddFolder] = useState(false);

  async function loadFolders(selectId?: string) {
    const res = await fetch("/api/video-folders");
    const data: VideoFolder[] = await res.json();
    setFolders(data);
    const target = selectId ?? activeFolderId ?? data[0]?.id ?? null;
    setActiveFolderId(target);
  }

  async function loadVideos(folderId: string) {
    setLoading(true);
    setVideos([]);
    try {
      const res = await fetch(`/api/videos?folderId=${folderId}`);
      if (res.ok) setVideos(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadFolders(); }, []);

  useEffect(() => {
    if (activeFolderId) loadVideos(activeFolderId);
  }, [activeFolderId]);

  async function handleFolderConfirmed() {
    setShowAddFolder(false);
    const res = await fetch("/api/video-folders");
    const data: VideoFolder[] = await res.json();
    setFolders(data);
    setActiveFolderId(data[data.length - 1]?.id ?? null);
  }

  async function removeFolder(id: string) {
    if (!confirm("Remove this folder from the list?")) return;
    await fetch(`/api/video-folders/${id}`, { method: "DELETE" });
    const updated = folders.filter((f) => f.id !== id);
    setFolders(updated);
    if (activeFolderId === id) {
      setActiveFolderId(updated[0]?.id ?? null);
      setVideos([]);
    }
  }

  const activeFolder = folders.find((f) => f.id === activeFolderId);

  return (
    <div className="flex flex-col min-h-full">
      {watching && <VideoModal entry={watching} onClose={() => setWatching(null)} />}
      {showAddFolder && (
        <AddFolderModal
          onConfirm={handleFolderConfirmed}
          onCancel={() => setShowAddFolder(false)}
        />
      )}

      {/* Folder tabs */}
      <div className="flex items-center gap-0.5 px-6 pt-5 border-b border-[var(--border)] overflow-x-auto shrink-0">
        {folders.map((folder) => (
          <div
            key={folder.id}
            className={`flex items-center gap-1.5 group shrink-0 px-3.5 py-2 rounded-t-lg border-b-2 cursor-pointer text-sm font-medium transition-colors ${
              activeFolderId === folder.id
                ? "border-indigo-500 text-white bg-indigo-600/10"
                : "border-transparent text-gray-400 hover:text-white hover:bg-white/5"
            }`}
            onClick={() => setActiveFolderId(folder.id)}
          >
            <span>{folder.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); removeFolder(folder.id); }}
              className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs leading-none ml-0.5"
              title="Remove folder"
            >✕</button>
          </div>
        ))}
        <button
          onClick={() => setShowAddFolder(true)}
          className="shrink-0 px-3.5 py-2 text-sm text-indigo-400 hover:text-indigo-300 hover:bg-indigo-600/10 rounded-t-lg transition-colors"
        >
          + Add Folder
        </button>
      </div>

      {/* Body */}
      <div className="p-8 flex flex-col gap-6 flex-1">

        {folders.length === 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-16 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--border)] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <p className="text-white font-medium">No folders added yet</p>
            <p className="text-sm text-gray-500 mt-1">Add a folder to browse and upload your videos.</p>
            <button
              onClick={() => setShowAddFolder(true)}
              className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >+ Add Folder</button>
          </div>
        )}

        {activeFolder && (
          <p className="text-xs text-gray-600 font-mono truncate">{activeFolder.path}</p>
        )}

        {loading && <p className="text-gray-500 text-sm">Scanning folder…</p>}

        {!loading && activeFolder && (
          videos.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-10 text-center">
              <p className="text-gray-500 text-sm">No video files found in this folder.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">{videos.length} video{videos.length !== 1 ? "s" : ""}</p>
              <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4">
                {videos.map((v) => (
                  <VideoCard
                    key={v.path}
                    entry={v}
                    onWatch={() => setWatching(v)}
                    onUpload={() => router.push(`/post?videoPath=${encodeURIComponent(v.path)}`)}
                    onRefresh={() => activeFolderId && loadVideos(activeFolderId)}
                  />
                ))}
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
