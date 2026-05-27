"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";

/* ── Constants ───────────────────────────────────────────────────────────── */

const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v", ".wmv"]);

/* ── Types ───────────────────────────────────────────────────────────────── */

type FolderEntry = {
  id: string;
  label: string;
  handle: FileSystemDirectoryHandle;
};

type VideoEntry = {
  name: string;
  handle: FileSystemFileHandle;
  size: number;
  sizeLabel: string;
  objectUrl: string;
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function listVideos(dirHandle: FileSystemDirectoryHandle): Promise<VideoEntry[]> {
  const entries: VideoEntry[] = [];
  for await (const [name, handle] of dirHandle as unknown as AsyncIterable<[string, FileSystemHandle]>) {
    if (handle.kind !== "file") continue;
    const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
    if (!VIDEO_EXTS.has(ext)) continue;
    const file = await (handle as FileSystemFileHandle).getFile();
    entries.push({
      name,
      handle: handle as FileSystemFileHandle,
      size: file.size,
      sizeLabel: formatSize(file.size),
      objectUrl: URL.createObjectURL(file),
    });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
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
        <video src={entry.objectUrl} controls autoPlay className="w-full max-h-[72vh] bg-black" />
        <div className="px-5 py-3 text-xs text-gray-500">{entry.sizeLabel} · {entry.name}</div>
      </div>
    </div>
  );
}

/* ── VideoCard ───────────────────────────────────────────────────────────── */

function VideoCard({
  entry,
  onWatch,
  onUpload,
  onDelete,
  onRename,
}: {
  entry: VideoEntry;
  onWatch: () => void;
  onUpload: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(entry.name);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [menuOpen]);

  function saveRename() {
    const newName = draft.trim();
    if (newName && newName !== entry.name) onRename(newName);
    setRenaming(false);
  }

  return (
    <div className="relative rounded-xl overflow-hidden break-inside-avoid mb-4 group bg-black/30">
      <video
        src={`${entry.objectUrl}#t=0.5`}
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
              onClick={() => { setMenuOpen(false); onDelete(); }}
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
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [watching, setWatching] = useState<VideoEntry | null>(null);
  const [uploading, setUploading] = useState<string | null>(null); // video name being uploaded

  // Revoke object URLs when videos change or component unmounts
  useEffect(() => {
    return () => {
      videos.forEach((v) => URL.revokeObjectURL(v.objectUrl));
    };
  }, [videos]);

  async function loadVideos(handle: FileSystemDirectoryHandle) {
    setLoading(true);
    setVideos([]);
    try {
      const entries = await listVideos(handle);
      setVideos(entries);
    } catch (e) {
      alert("Could not read folder: " + (e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!activeFolderId) return;
    const folder = folders.find((f) => f.id === activeFolderId);
    if (folder) loadVideos(folder.handle);
  }, [activeFolderId]);

  async function pickFolder() {
    let dirHandle: FileSystemDirectoryHandle;
    try {
      dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
    } catch (e: any) {
      if (e?.name !== "AbortError") alert("Could not access folder: " + (e?.message ?? e));
      return;
    }

    const id = nanoid(6);
    const folder: FolderEntry = { id, label: dirHandle.name, handle: dirHandle };
    setFolders((prev) => [...prev, folder]);
    setActiveFolderId(id);
    loadVideos(dirHandle);
  }

  function removeFolder(id: string) {
    const updated = folders.filter((f) => f.id !== id);
    setFolders(updated);
    if (activeFolderId === id) {
      videos.forEach((v) => URL.revokeObjectURL(v.objectUrl));
      setVideos([]);
      setActiveFolderId(updated[0]?.id ?? null);
    }
  }

  async function handleUpload(entry: VideoEntry) {
    setUploading(entry.name);
    try {
      const file = await entry.handle.getFile();
      const form = new FormData();
      form.append("file", file, entry.name);
      const res = await fetch("/api/videos/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
      const { path } = await res.json();
      router.push(`/post?videoPath=${encodeURIComponent(path)}`);
    } catch (e) {
      alert("Upload failed: " + (e instanceof Error ? e.message : e));
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(entry: VideoEntry, folderHandle: FileSystemDirectoryHandle) {
    if (!confirm(`Permanently delete "${entry.name}"?`)) return;
    try {
      await folderHandle.removeEntry(entry.name);
      URL.revokeObjectURL(entry.objectUrl);
      setVideos((prev) => prev.filter((v) => v.name !== entry.name));
    } catch (e) {
      alert("Delete failed: " + (e instanceof Error ? e.message : e));
    }
  }

  async function handleRename(entry: VideoEntry, newName: string, folderHandle: FileSystemDirectoryHandle) {
    try {
      // Read original file, write under new name, delete old
      const file = await entry.handle.getFile();
      const newHandle = await folderHandle.getFileHandle(newName, { create: true });
      const writable = await newHandle.createWritable();
      await writable.write(file);
      await writable.close();
      await folderHandle.removeEntry(entry.name);
      URL.revokeObjectURL(entry.objectUrl);
      // Reload to reflect the rename
      await loadVideos(folderHandle);
    } catch (e) {
      alert("Rename failed: " + (e instanceof Error ? e.message : e));
    }
  }

  const activeFolder = folders.find((f) => f.id === activeFolderId);

  return (
    <div className="flex flex-col min-h-full">
      {watching && <VideoModal entry={watching} onClose={() => setWatching(null)} />}

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
          onClick={pickFolder}
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
              onClick={pickFolder}
              className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >+ Add Folder</button>
          </div>
        )}

        {loading && <p className="text-gray-500 text-sm">Scanning folder…</p>}

        {uploading && (
          <p className="text-indigo-400 text-sm">Preparing "{uploading}" for upload…</p>
        )}

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
                    key={v.name}
                    entry={v}
                    onWatch={() => setWatching(v)}
                    onUpload={() => handleUpload(v)}
                    onDelete={() => handleDelete(v, activeFolder.handle)}
                    onRename={(newName) => handleRename(v, newName, activeFolder.handle)}
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
