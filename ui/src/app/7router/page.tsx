"use client";

import { useEffect, useRef, useState } from "react";

type StorageProvider = {
  id: string;
  name: string;
  baseUrl: string;
  accessToken: string;
  updatedAt: string;
};

type AccessDirectory = { path: string; access: string };
type AccessResponse = { isAdmin: boolean; directories: AccessDirectory[] };
type StorageItem = {
  name: string;
  absolutePath: string;
  type: "file" | "folder" | string;
  sizeBytes?: number;
  cdnUrl?: string;
};

function formatBytes(value?: number) {
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/* ── Settings Dialog ──────────────────────────────────────────────────── */

function SettingsDialog({
  provider,
  onClose,
  onSaved,
}: {
  provider: StorageProvider;
  onClose: () => void;
  onSaved: (updated: StorageProvider) => void;
}) {
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl);
  const [accessToken, setAccessToken] = useState(provider.accessToken);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/7router/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), accessToken }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? "Failed to save");
      onSaved({ ...provider, baseUrl: baseUrl.trim(), accessToken });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-md mx-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-sm font-semibold text-white">7router Settings</h2>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{provider.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">API URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:20131"
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Access Token</label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Bearer token"
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[var(--border)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function RouterPage() {
  const [provider, setProvider] = useState<StorageProvider | null>(null);
  const [accessDirs, setAccessDirs] = useState<AccessDirectory[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [pathStack, setPathStack] = useState<string[]>([]);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  async function loadDirectories(pid: string) {
    const dirRes = await fetch(`/api/7router/${pid}/access/directories`);
    const dirData: AccessResponse = await dirRes.json();
    if (!dirRes.ok) throw new Error((dirData as { message?: string }).message ?? "Failed to load directories");
    setIsAdmin(dirData.isAdmin);
    setAccessDirs(dirData.directories ?? []);
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/7router", { cache: "no-store" });
        const providers = await res.json();
        if (!res.ok) throw new Error(providers.message ?? "Failed to load storage");
        const p: StorageProvider = Array.isArray(providers) ? providers[0] : null;
        if (!p) throw new Error("No storage provider configured");
        setProvider(p);
        await loadDirectories(p.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function listDirectory(path: string) {
    if (!provider) return;
    setListing(true);
    setError(null);
    try {
      const res = await fetch(`/api/7router/${provider.id}/files/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? `Storage list failed (${res.status})`);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setCurrentPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setListing(false);
    }
  }

  function navigateTo(path: string) {
    setPathStack((s) => [...s, currentPath ?? ""]);
    listDirectory(path);
  }

  function navigateBack() {
    const stack = [...pathStack];
    const prev = stack.pop() ?? "";
    setPathStack(stack);
    if (!prev) {
      setCurrentPath(null);
      setItems([]);
    } else {
      listDirectory(prev);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-4xl space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-[var(--muted)] rounded-lg" />
        <div className="h-64 rounded-xl border border-[var(--border)] bg-[var(--muted)]" />
      </div>
    );
  }

  return (
    <>
      {showSettings && provider && (
        <SettingsDialog
          provider={provider}
          onClose={() => setShowSettings(false)}
          onSaved={(updated) => {
            setProvider(updated);
            setCurrentPath(null);
            setItems([]);
            setPathStack([]);
            loadDirectories(updated.id).catch((err) =>
              setError(err instanceof Error ? err.message : String(err)),
            );
          }}
        />
      )}

      <div className="p-8 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">7router</h1>
            <p className="text-sm text-gray-500 mt-1">Browse files and folders from cloud storage.</p>
          </div>
          <div className="flex items-center gap-2">
            {currentPath !== null && (
              <button
                type="button"
                onClick={navigateBack}
                disabled={listing}
                className="px-3 py-1.5 text-xs text-gray-300 hover:text-white border border-[var(--border)] hover:border-gray-500 rounded-lg transition-colors disabled:opacity-50"
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              title="7router settings"
              className="p-2 text-gray-500 hover:text-white border border-[var(--border)] hover:border-gray-500 rounded-lg transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 1C7.08579 1 6.75 1.33579 6.75 1.75V2.34842C6.24053 2.48024 5.76537 2.70584 5.34835 3.00554L4.91289 2.5701C4.62 2.27721 4.14513 2.27721 3.85223 2.5701L3.07017 3.35216C2.77728 3.64505 2.77728 4.11992 3.07017 4.41281L3.50563 4.84827C3.20593 5.26529 2.98033 5.74045 2.84851 6.24992H2.25C1.83579 6.24992 1.5 6.58571 1.5 6.99992V8.49992C1.5 8.91413 1.83579 9.24992 2.25 9.24992H2.84851C2.98033 9.75939 3.20593 10.2346 3.50563 10.6516L3.07017 11.087C2.77728 11.3799 2.77728 11.8548 3.07017 12.1477L3.85223 12.9297C4.14513 13.2226 4.62 13.2226 4.91289 12.9297L5.34835 12.4943C5.76537 12.794 6.24053 13.0196 6.75 13.1514V13.7499C6.75 14.1641 7.08579 14.4999 7.5 14.4999C7.91421 14.4999 8.25 14.1641 8.25 13.7499V13.1514C8.75947 13.0196 9.23463 12.794 9.65165 12.4943L10.0871 12.9297C10.38 13.2226 10.8549 13.2226 11.1478 12.9297L11.9298 12.1477C12.2227 11.8548 12.2227 11.3799 11.9298 11.087L11.4944 10.6516C11.7941 10.2346 12.0197 9.75939 12.1515 9.24992H12.75C13.1642 9.24992 13.5 8.91413 13.5 8.49992V6.99992C13.5 6.58571 13.1642 6.24992 12.75 6.24992H12.1515C12.0197 5.74045 11.7941 5.26529 11.4944 4.84827L11.9298 4.41281C12.2227 4.11992 12.2227 3.64505 11.9298 3.35216L11.1478 2.5701C10.8549 2.27721 10.38 2.27721 10.0871 2.5701L9.65165 3.00554C9.23463 2.70584 8.75947 2.48024 8.25 2.34842V1.75C8.25 1.33579 7.91421 1 7.5 1ZM7.5 5.25C6.25736 5.25 5.25 6.25736 5.25 7.5C5.25 8.74264 6.25736 9.75 7.5 9.75C8.74264 9.75 9.75 8.74264 9.75 7.5C9.75 6.25736 8.74264 5.25 7.5 5.25Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-5 text-sm rounded-lg px-3 py-2 border text-red-400 bg-red-500/10 border-red-500/20">
            {error}
          </p>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {currentPath === null ? "Accessible Directories" : "Directory Contents"}
              </h2>
              {currentPath !== null && (
                <p className="text-xs text-gray-600 font-mono truncate mt-1">{currentPath}</p>
              )}
            </div>
            {currentPath !== null && (
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                <button
                  type="button"
                  onClick={() => listDirectory(currentPath)}
                  disabled={listing}
                  className="px-3 py-1.5 text-xs text-gray-300 hover:text-white border border-[var(--border)] hover:border-gray-500 rounded-md disabled:opacity-50 transition-colors"
                >
                  {listing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            )}
          </div>

          {currentPath === null ? (
            accessDirs.length === 0 && !isAdmin ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-gray-500">No accessible directories.</p>
                <p className="text-xs text-gray-600 mt-1">Configure the access token via the settings icon.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {isAdmin && (
                  <div className="px-5 py-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                    <span className="text-xs text-yellow-400">Admin token — full access</span>
                  </div>
                )}
                {accessDirs.map((dir) => (
                  <div key={dir.path} className="px-5 py-3 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => navigateTo(dir.path)}
                        disabled={listing}
                        className="text-sm text-white hover:text-indigo-300 truncate text-left max-w-full disabled:opacity-60"
                      >
                        {dir.path}
                      </button>
                    </div>
                    <span className="text-xs text-gray-500">{dir.access}</span>
                  </div>
                ))}
              </div>
            )
          ) : listing ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-gray-500">No files found.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {items.map((item) => (
                <div key={item.absolutePath} className="px-5 py-3 flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${item.type === "folder" ? "bg-indigo-400" : "bg-green-400"}`} />
                  <div className="flex-1 min-w-0">
                    {item.type === "folder" ? (
                      <button
                        type="button"
                        onClick={() => navigateTo(item.absolutePath)}
                        disabled={listing}
                        className="text-sm text-white hover:text-indigo-300 truncate text-left max-w-full disabled:opacity-60"
                      >
                        {item.name}
                      </button>
                    ) : (
                      <p className="text-sm text-white truncate">{item.name}</p>
                    )}
                    <p className="text-xs text-gray-600 font-mono truncate">{item.absolutePath}</p>
                  </div>
                  <span className="text-xs text-gray-500">{item.type}</span>
                  {item.sizeBytes !== undefined && (
                    <span className="text-xs text-gray-500">{formatBytes(item.sizeBytes)}</span>
                  )}
                  {item.cdnUrl && (
                    <a
                      href={item.cdnUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Open
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
