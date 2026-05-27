"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

/* ── Types ──────────────────────────────────────────────────────────── */

type Provider = {
  id: string;
  name: string;
  type: string;
  clientId: string | null;
  scopes: string | null;
  createdAt: string;
};

type Account = {
  id: string;
  providerId: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  scopes: string | null;
  expiresAt: string | null;
  createdAt: string;
  providerName: string | null;
  providerType: string | null;
};

type Destination = {
  id: string;
  socialAccountId: string;
  name: string;
  type: string;
  externalId: string | null;
  accountUsername: string | null;
};

function destUrl(dest: Destination): string | null {
  const { type, externalId, accountUsername } = dest;
  const validId = externalId && externalId !== "unknown" ? externalId : null;
  if (type === "youtube_channel") {
    // customUrl is returned by the API as "@handle" or "handle" — normalise to /@handle
    if (accountUsername) {
      const handle = accountUsername.startsWith("@") ? accountUsername : `@${accountUsername}`;
      return `https://www.youtube.com/${handle}`;
    }
    if (validId) return `https://www.youtube.com/channel/${validId}`;
    return null;
  }
  if (type === "facebook_page" && validId) return `https://www.facebook.com/profile.php?id=${validId}`;
  if (type === "tiktok_account" && accountUsername) return `https://www.tiktok.com/@${accountUsername}`;
  if (type === "instagram_account" && accountUsername) return `https://www.instagram.com/${accountUsername}/`;
  return null;
}

const DEST_COLORS: Record<string, string> = {
  youtube_channel: "bg-red-600",
  facebook_page: "bg-blue-700",
  tiktok_account: "bg-gray-800",
  instagram_account: "bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400",
};
const DEST_ABBR: Record<string, string> = {
  youtube_channel: "YT",
  facebook_page: "FB",
  tiktok_account: "TK",
  instagram_account: "IG",
};
const DEST_LABEL: Record<string, string> = {
  youtube_channel: "YouTube Channel",
  facebook_page: "Facebook Page",
  tiktok_account: "TikTok Account",
  instagram_account: "Instagram Account",
};

/* ── Provider metadata (same as list page) ──────────────────────────── */

type ProviderMeta = {
  label: string;
  defaultScopes: string;
  devConsole: string;
  devConsoleLabel: string;
  notes: string[];
  Icon: React.FC<{ className?: string }>;
};

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
    </svg>
  );
}
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.17 8.17 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
    </svg>
  );
}
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}
const PROVIDER_META: Record<string, ProviderMeta> = {
  youtube: {
    label: "YouTube",
    defaultScopes: "https://www.googleapis.com/auth/youtube.upload,https://www.googleapis.com/auth/youtube.readonly",
    devConsole: "https://console.cloud.google.com/apis/credentials",
    devConsoleLabel: "Google Cloud Console",
    notes: [
      'Create an OAuth 2.0 Client ID (type: Web application).',
      'Add the redirect URI below to "Authorized redirect URIs".',
      "Enable the YouTube Data API v3 in your project.",
      "Both youtube.upload and youtube.readonly scopes are required.",
    ],
    Icon: YouTubeIcon,
  },
  tiktok: {
    label: "TikTok",
    defaultScopes: "user.info.basic,video.upload,video.publish",
    devConsole: "https://developers.tiktok.com/apps/",
    devConsoleLabel: "TikTok for Developers",
    notes: [
      "Create an app and add the Login Kit + Content Posting API products.",
      'Add the redirect URI below to "Redirect URI for Login Kit".',
      "Client Key = Client ID · Client Secret = Client Secret.",
    ],
    Icon: TikTokIcon,
  },
  facebook: {
    label: "Facebook",
    defaultScopes: "pages_manage_posts,pages_read_engagement,pages_show_list,publish_video",
    devConsole: "https://developers.facebook.com/apps/",
    devConsoleLabel: "Meta for Developers",
    notes: [
      "Create a Business app and add the Facebook Login product.",
      'Add the redirect URI below to "Valid OAuth Redirect URIs".',
      "You must manage at least one Facebook Page to connect.",
      "Request the pages_manage_posts and publish_video permissions.",
    ],
    Icon: FacebookIcon,
  },
  instagram: {
    label: "Instagram",
    defaultScopes: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
    devConsole: "https://developers.facebook.com/apps/",
    devConsoleLabel: "Meta for Developers",
    notes: [
      "Create a Business app (same as or separate from your Facebook app).",
      "Add the Instagram Graph API and Facebook Login products.",
      'Add the redirect URI below to "Valid OAuth Redirect URIs".',
      "Your Instagram account must be a Professional account connected to a Facebook Page.",
    ],
    Icon: InstagramIcon,
  },
};

const ICON_COLORS: Record<string, string> = {
  youtube: "bg-red-600",
  tiktok: "bg-gray-900",
  facebook: "bg-blue-700",
  instagram: "bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400",
};

const REDIRECT_URI = "http://localhost:20129/api/accounts/oauth/callback";

/* ── Configure-app modal ─────────────────────────────────────────────── */

function mergeScopes(stored: string, defaults: string): string {
  const toList = (s: string) => s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
  const merged = [...new Set([...toList(stored), ...toList(defaults)])];
  return merged.join(",");
}

function ConfigureAppModal({
  type,
  existing,
  onClose,
  onSaved,
}: {
  type: string;
  existing?: Provider;
  onClose: () => void;
  onSaved: () => void;
}) {
  const meta = PROVIDER_META[type];
  const isEdit = !!existing;
  const [form, setForm] = useState({
    name: existing?.name ?? `My ${meta.label} App`,
    clientId: existing?.clientId ?? "",
    clientSecret: "",
    // In edit mode merge stored scopes with current defaults so missing ones are added
    scopes: existing?.scopes
      ? mergeScopes(existing.scopes, meta.defaultScopes)
      : meta.defaultScopes,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function copyRedirectUri() {
    navigator.clipboard.writeText(REDIRECT_URI);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const url = isEdit ? `/api/providers/${existing!.id}` : "/api/providers";
      const method = isEdit ? "PATCH" : "POST";
      const body: Record<string, unknown> = {
        name: form.name,
        scopes: form.scopes ? form.scopes.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      };
      if (form.clientId) body.clientId = form.clientId;
      if (form.clientSecret) body.clientSecret = form.clientSecret;
      if (!isEdit) { body.type = type; }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed");
      } else {
        onSaved();
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
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--muted)]">
          <h2 className="text-sm font-semibold text-white">{isEdit ? "Edit" : "Configure"} {meta.label} App</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">App Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
            />
          </div>

          {/* Redirect URI */}
          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-2">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">
              OAuth Redirect URI
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-white bg-black/40 px-2 py-1.5 rounded border border-[var(--border)] truncate">
                {REDIRECT_URI}
              </code>
              <button
                type="button"
                onClick={copyRedirectUri}
                className="text-xs text-indigo-400 hover:text-indigo-300 px-2.5 py-1.5 rounded border border-indigo-500/30 shrink-0 transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Setup notes */}
          {meta.notes.length > 0 && (
            <div className="rounded-lg bg-black/20 border border-[var(--border)] p-4 space-y-1.5">
              {meta.devConsole && (
                <a
                  href={meta.devConsole}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mb-1"
                >
                  → Open {meta.devConsoleLabel} ↗
                </a>
              )}
              {meta.notes.map((note, i) => (
                <p key={i} className="text-xs text-gray-500">
                  {i + 1}. {note}
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Client ID</label>
              <input
                required
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
                placeholder="your-client-id"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Client Secret</label>
              <input
                type="password"
                required={!isEdit}
                value={form.clientSecret}
                onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
                className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
                placeholder={isEdit ? "leave blank to keep current" : "your-client-secret"}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Scopes <span className="text-gray-600">(pre-filled with recommended defaults)</span>
            </label>
            <input
              value={form.scopes}
              onChange={(e) => setForm((f) => ({ ...f, scopes: e.target.value }))}
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-mono text-xs transition-colors"
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
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Save App"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Account row ─────────────────────────────────────────────────────── */

function AccountRow({
  account,
  destinations,
  onDisconnect,
  onRename,
  onDestinationsChanged,
}: {
  account: Account;
  destinations: Destination[];
  onDisconnect: () => void;
  onRename: (name: string) => Promise<void>;
  onDestinationsChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(account.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; kind: "error" | "warning" | "ok" } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const isFacebook = account.providerType === "facebook";
  const singleDest = destinations.length === 1 ? destinations[0] : null;
  const multiDest = destinations.length !== 1;

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`/api/accounts/${account.id}/sync-destinations`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncMsg({ text: data.error ?? "Sync failed", kind: "error" });
      } else {
        if (data.warning) setSyncMsg({ text: data.warning, kind: "warning" });
        else setSyncMsg({ text: `${data.destinations.length} destination${data.destinations.length !== 1 ? "s" : ""} synced`, kind: "ok" });
        onDestinationsChanged();
      }
    } finally {
      setSyncing(false);
    }
  }

  async function save() {
    if (!draft.trim() || draft === account.displayName) { setEditing(false); return; }
    setSaving(true);
    await onRename(draft.trim());
    setSaving(false);
    setEditing(false);
  }

  const displayName = account.displayName ?? account.username ?? account.id;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-black/20 overflow-hidden">
      {/* Account header row */}
      <div
        className={`flex items-center gap-3 px-4 py-3 transition-colors ${multiDest ? "cursor-pointer hover:bg-white/[0.02]" : ""}`}
        onClick={() => multiDest && !editing && setExpanded((v) => !v)}
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center shrink-0 overflow-hidden">
          {account.avatarUrl ? (
            <img src={account.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-indigo-400">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") { setDraft(account.displayName ?? ""); setEditing(false); }
                }}
                className="flex-1 bg-black/40 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none min-w-0"
              />
              <button onClick={save} disabled={saving} className="text-xs text-indigo-400 hover:text-indigo-300 shrink-0">
                {saving ? "…" : "✓"}
              </button>
              <button
                onClick={() => { setDraft(account.displayName ?? ""); setEditing(false); }}
                className="text-xs text-gray-500 hover:text-gray-300 shrink-0"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-white font-medium truncate">{displayName}</p>
              <span className="inline-flex items-center gap-1 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                active
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setDraft(account.displayName ?? account.username ?? ""); setEditing(true); }}
                className="text-gray-600 hover:text-gray-400 text-xs shrink-0"
                title="Rename"
              >
                ✏
              </button>
            </div>
          )}
          {account.username && !editing && (
            <p className="text-xs text-gray-600 mt-0.5">@{account.username}</p>
          )}
          {singleDest && !editing && (() => {
            const url = destUrl(singleDest);
            const bg = DEST_COLORS[singleDest.type] ?? "bg-gray-700";
            const abbr = DEST_ABBR[singleDest.type] ?? singleDest.type.slice(0, 2).toUpperCase();
            return (
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`w-4 h-4 rounded ${bg} flex items-center justify-center shrink-0`}>
                  <span className="text-[8px] font-bold text-white">{abbr}</span>
                </div>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline truncate"
                  >
                    {singleDest.name} ↗
                  </a>
                ) : (
                  <span className="text-xs text-gray-500 truncate">{singleDest.name}</span>
                )}
              </div>
            );
          })()}
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isFacebook && syncMsg && (
            <span className={`text-xs max-w-[220px] truncate ${
              syncMsg.kind === "error" ? "text-red-400" :
              syncMsg.kind === "warning" ? "text-yellow-400" :
              "text-green-400"
            }`} title={syncMsg.text}>
              {syncMsg.text}
            </span>
          )}
          {isFacebook && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-[var(--border)] hover:border-gray-500 transition-colors disabled:opacity-50"
              title="Sync page destination"
            >
              {syncing ? "Syncing…" : "Sync"}
            </button>
          )}
          <button
            onClick={onDisconnect}
            className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-400/50 transition-colors"
          >
            Disconnect
          </button>
          {multiDest && (
            <span className="text-gray-600 text-xs ml-1 select-none">{expanded ? "▲" : "▼"}</span>
          )}
        </div>
      </div>

      {/* Destinations — only shown as expandable when 0 or 2+ */}
      {multiDest && expanded && (
        <div className="border-t border-[var(--border)] px-4 py-3 space-y-2">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Destinations ({destinations.length})
          </p>
          {destinations.length === 0 ? (
            <p className="text-xs text-gray-600 py-1">
              {isFacebook
                ? <>No destination yet — click <span className="text-gray-400">Sync</span> to fetch the page.</>
                : "No destination yet — try disconnecting and reconnecting this account."}
            </p>
          ) : (
            destinations.map((dest) => {
              const bg = DEST_COLORS[dest.type] ?? "bg-gray-700";
              const abbr = DEST_ABBR[dest.type] ?? dest.type.slice(0, 2).toUpperCase();
              const label = DEST_LABEL[dest.type] ?? dest.type;
              const url = destUrl(dest);
              return (
                <div key={dest.id} className="flex items-center gap-2.5 py-1">
                  <div className={`w-6 h-6 rounded-md ${bg} flex items-center justify-center shrink-0`}>
                    <span className="text-[9px] font-bold text-white">{abbr}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline truncate block"
                      >
                        {dest.name} ↗
                      </a>
                    ) : (
                      <p className="text-xs text-white truncate">{dest.name}</p>
                    )}
                    <p className="text-[10px] text-gray-600">{label}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ── Provider section (one configured app + its accounts) ───────────── */

function ProviderSection({
  provider,
  accounts,
  destinations,
  onConnect,
  onDelete,
  onDisconnect,
  onRenameAccount,
  onDestinationsChanged,
}: {
  provider: Provider;
  accounts: Account[];
  destinations: Destination[];
  onConnect: (providerId: string) => void;
  onDelete: (providerId: string) => void;
  onDisconnect: (accountId: string) => void;
  onRenameAccount: (accountId: string, name: string) => Promise<void>;
  onDestinationsChanged: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
      {/* App header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div>
          <p className="text-sm font-medium text-white">{provider.name}</p>
          {provider.clientId && (
            <p className="text-xs text-gray-600 font-mono mt-0.5">
              {provider.clientId.slice(0, 20)}…
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onConnect(provider.id)}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            + Connect Account
          </button>
          <button
            onClick={() => onDelete(provider.id)}
            className="text-xs text-gray-500 hover:text-red-400 px-2 py-1.5 rounded-lg border border-[var(--border)] hover:border-red-500/30 transition-colors"
            title="Remove app configuration"
          >
            Remove App
          </button>
        </div>
      </div>

      {/* Accounts */}
      <div className="p-3 space-y-2">
        {accounts.length === 0 ? (
          <div className="py-6 text-center">
            <div className="w-10 h-10 rounded-full bg-[var(--border)] flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">No accounts connected yet</p>
            <p className="text-xs text-gray-600 mt-0.5">Add your first connection to get started</p>
            <button
              onClick={() => onConnect(provider.id)}
              className="mt-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              + Add Connection
            </button>
          </div>
        ) : (
          accounts.map((acc) => (
            <AccountRow
              key={acc.id}
              account={acc}
              destinations={destinations.filter((d) => d.socialAccountId === acc.id)}
              onDisconnect={() => onDisconnect(acc.id)}
              onRename={(name) => onRenameAccount(acc.id, name)}
              onDestinationsChanged={onDestinationsChanged}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ── Page content ────────────────────────────────────────────────────── */

function ProviderDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = params.type as string;
  const meta = PROVIDER_META[type];

  const [providers, setProviders] = useState<Provider[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<Provider | null | "new">(null);
  const [flash, setFlash] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  // Redirect unknown types back to providers list
  useEffect(() => {
    if (!meta) router.replace("/providers");
  }, [meta, router]);

  async function load() {
    const [provRes, accRes, destRes] = await Promise.all([
      fetch("/api/providers"),
      fetch("/api/accounts"),
      fetch("/api/publish-destinations"),
    ]);
    const allProviders: Provider[] = await provRes.json();
    const allAccounts: Account[] = await accRes.json();
    const allDests: Destination[] = await destRes.json();
    setProviders(allProviders.filter((p) => p.type === type));
    setAccounts(allAccounts.filter((a) => a.providerType === type));
    setDestinations(allDests);
  }

  useEffect(() => {
    load();
    if (searchParams.get("connected")) {
      setFlash({ kind: "success", msg: "Account connected successfully!" });
    }
    if (searchParams.get("error")) {
      setFlash({ kind: "error", msg: decodeURIComponent(searchParams.get("error")!) });
    }
  }, [searchParams]);

  async function handleConnect(providerId: string) {
    setConnecting(providerId);
    setFlash(null);
    try {
      const res = await fetch("/api/accounts/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setFlash({ kind: "error", msg: data.error ?? "Failed to start OAuth" });
      }
    } catch {
      setFlash({ kind: "error", msg: "Connection failed" });
    } finally {
      setConnecting(null);
    }
  }

  async function handleDeleteProvider(id: string) {
    if (!confirm("Remove this app configuration? Connected accounts will also be removed.")) return;
    await fetch(`/api/providers/${id}`, { method: "DELETE" });
    await load();
  }

  async function handleDisconnect(accountId: string) {
    if (!confirm("Disconnect this account?")) return;
    await fetch(`/api/accounts/${accountId}`, { method: "DELETE" });
    await load();
  }

  async function handleRenameAccount(accountId: string, displayName: string) {
    await fetch(`/api/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    await load();
  }

  if (!meta) return null;

  const { Icon, label } = meta;
  const iconBg = ICON_COLORS[type] ?? "bg-gray-700";
  const totalAccounts = accounts.length;

  return (
    <div className="p-8 flex flex-col gap-6 min-h-full">
      {editingProvider !== null && (
        <ConfigureAppModal
          type={type}
          existing={editingProvider === "new" ? undefined : editingProvider}
          onClose={() => setEditingProvider(null)}
          onSaved={load}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => router.push("/providers")} className="hover:text-white transition-colors">
          Providers
        </button>
        <span>›</span>
        <span className="text-white">{label}</span>
      </div>

      {/* Flash message */}
      {flash && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            flash.kind === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {flash.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center shrink-0`}>
            <Icon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{label}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalAccounts === 0
                ? "No connections"
                : `${totalAccounts} connection${totalAccounts !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        {providers.length === 0 ? (
          <button
            onClick={() => setEditingProvider("new")}
            className="text-sm border border-[var(--border)] hover:border-indigo-500/50 text-gray-400 hover:text-white px-4 py-2 rounded-lg transition-colors"
          >
            + Configure App
          </button>
        ) : (
          <button
            onClick={() => setEditingProvider(providers[0])}
            className="text-sm border border-[var(--border)] hover:border-indigo-500/50 text-gray-400 hover:text-white px-4 py-2 rounded-lg transition-colors"
          >
            Edit Provider
          </button>
        )}
      </div>

      {/* No app configured */}
      {providers.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--border)] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-white font-medium">No app configured</p>
          <p className="text-sm text-gray-500 mt-1">
            Configure your {label} OAuth app to start connecting accounts.
          </p>
          <button
            onClick={() => setEditingProvider("new")}
            className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Configure {label} App
          </button>
        </div>
      ) : (
        /* Provider sections */
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Connections
          </h2>
          {providers.map((provider) => {
            const providerAccounts = accounts.filter((a) => a.providerId === provider.id);
            return (
              <ProviderSection
                key={provider.id}
                provider={provider}
                accounts={providerAccounts}
                destinations={destinations}
                onConnect={handleConnect}
                onDelete={handleDeleteProvider}
                onDisconnect={handleDisconnect}
                onRenameAccount={handleRenameAccount}
                onDestinationsChanged={load}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProviderDetailPage() {
  return (
    <Suspense>
      <ProviderDetailContent />
    </Suspense>
  );
}
