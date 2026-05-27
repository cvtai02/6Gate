"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  providerType: string | null;
};

/* ── per-type static metadata ─────────────────────────────────────────── */

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

    defaultScopes: "https://www.googleapis.com/auth/youtube.upload",
    devConsole: "https://console.cloud.google.com/apis/credentials",
    devConsoleLabel: "Google Cloud Console",
    notes: [
      'Create an OAuth 2.0 Client ID (type: Web application).',
      'Add the redirect URI below to "Authorized redirect URIs".',
      "Enable the YouTube Data API v3 in your project.",
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

/* ── Provider card ────────────────────────────────────────────────────── */

function ProviderTypeCard({
  type,
  count,
  onClick,
}: {
  type: string;
  count: number;
  onClick: (type: string) => void;
}) {
  const meta = PROVIDER_META[type];
  if (!meta) return null;
  const { Icon, label } = meta;
  const iconBg = ICON_COLORS[type] ?? "bg-gray-700";

  return (
    <button
      onClick={() => onClick(type)}
      className="group rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4 flex items-center gap-3 hover:border-indigo-500/50 hover:bg-white/5 transition-all text-left w-full"
    >
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{label}</p>
        {count > 0 ? (
          <p className="text-xs text-green-400 flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            {count} connected
          </p>
        ) : (
          <p className="text-xs text-gray-500 mt-0.5">Not connected</p>
        )}
      </div>
    </button>
  );
}

/* ── Add-provider modal ───────────────────────────────────────────────── */

function AddProviderModal({
  initialType,
  onClose,
  onAdded,
}: {
  initialType?: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    type: initialType ?? "mock",
    clientId: "",
    clientSecret: "",
    scopes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const meta = PROVIDER_META[form.type] ?? PROVIDER_META.mock;

  function handleTypeChange(type: string) {
    const m = PROVIDER_META[type] ?? PROVIDER_META.mock;
    setForm((f) => ({ ...f, type, scopes: m.defaultScopes }));
  }

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
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          clientId: form.clientId || undefined,
          clientSecret: form.clientSecret || undefined,
          scopes: form.scopes
            ? form.scopes.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed");
      } else {
        onAdded();
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
          <h2 className="text-sm font-semibold text-white">Configure Provider</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
                placeholder="My YouTube App"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Platform</label>
              <select
                value={form.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
              >
                {Object.entries(PROVIDER_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
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

          {form.type !== "mock" && (
            <>
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
                    required
                    value={form.clientSecret}
                    onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
                    className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
                    placeholder="your-client-secret"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Scopes{" "}
                  <span className="text-gray-600">(pre-filled with recommended defaults)</span>
                </label>
                <input
                  value={form.scopes}
                  onChange={(e) => setForm((f) => ({ ...f, scopes: e.target.value }))}
                  className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-mono text-xs transition-colors"
                />
              </div>
            </>
          )}

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
              {submitting ? "Adding…" : "Add Provider"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Configured provider row ──────────────────────────────────────────── */

function ProviderRow({
  provider,
  onDelete,
}: {
  provider: Provider;
  onDelete: () => void;
}) {
  const meta = PROVIDER_META[provider.type];
  const Icon = meta?.Icon;
  const iconBg = ICON_COLORS[provider.type] ?? "bg-gray-700";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        {Icon ? (
          <Icon className="w-4 h-4 text-white" />
        ) : (
          <span className="text-xs font-bold text-white">{provider.type[0].toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">{provider.name}</p>
        <p className="text-xs text-gray-500 truncate mt-0.5">
          {provider.id}
          {provider.clientId && (
            <> · <span className="font-mono">{provider.clientId.slice(0, 14)}…</span></>
          )}
        </p>
      </div>
      <span className="text-xs text-gray-600 border border-[var(--border)] rounded-full px-2.5 py-0.5 shrink-0 capitalize">
        {provider.type}
      </span>
      <button
        onClick={onDelete}
        className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-400/50 transition-colors shrink-0"
      >
        Delete
      </button>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function ProvidersPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  async function load() {
    const [provRes, accRes] = await Promise.all([
      fetch("/api/providers"),
      fetch("/api/accounts"),
    ]);
    setProviders(await provRes.json());
    setAccounts(await accRes.json());
  }

  useEffect(() => { load(); }, []);

  function handleCardClick(type: string) {
    router.push(`/providers/${type}`);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this provider?")) return;
    await fetch(`/api/providers/${id}`, { method: "DELETE" });
    await load();
  }

  const connectedCountByType = (type: string) =>
    accounts.filter((a) => a.providerType === type).length;

  const oauthTypes = Object.keys(PROVIDER_META);

  return (
    <div className="p-8 flex flex-col gap-8 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Providers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your social media provider connections</p>
        </div>
      </div>

      {/* OAuth Providers section */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          OAuth Providers
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {oauthTypes.map((type) => (
            <ProviderTypeCard
              key={type}
              type={type}
              count={connectedCountByType(type)}
              onClick={handleCardClick}
            />
          ))}
        </div>
      </div>

      {/* Configured providers list */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Configured Providers
          {providers.length > 0 && (
            <span className="ml-2 text-gray-600 normal-case font-normal">
              {providers.length} total
            </span>
          )}
        </h2>

        {providers.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-10 text-center">
            <p className="text-gray-500 text-sm">No providers configured yet.</p>
            <p className="text-xs text-gray-600 mt-1">Click any platform card above to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {providers.map((p) => (
              <ProviderRow
                key={p.id}
                provider={p}
                onDelete={() => handleDelete(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
