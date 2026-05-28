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

function MetaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#meta-g0)"/>
      <path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#meta-g1)"/>
      <path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#meta-g2)"/>
      <path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#meta-g3)"/>
      <path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#meta-g4)"/>
      <path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#meta-g5)"/>
      <path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB"/>
      <path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#meta-g6)"/>
      <path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB"/>
      <path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#meta-g7)"/>
      <path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(#meta-g8)"/>
      <path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#meta-g9)"/>
      <path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#meta-g10)"/>
      <path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#meta-g11)"/>
      <path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#meta-g12)"/>
      <defs>
        <linearGradient id="meta-g0" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stopColor="#0867DF"/><stop offset="45.39%" stopColor="#0668E1"/><stop offset="85.91%" stopColor="#0064E0"/></linearGradient>
        <linearGradient id="meta-g1" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stopColor="#0064DF"/><stop offset="99.88%" stopColor="#0064E0"/></linearGradient>
        <linearGradient id="meta-g2" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stopColor="#0072EC"/><stop offset="68.81%" stopColor="#0064DF"/></linearGradient>
        <linearGradient id="meta-g3" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stopColor="#007CF6"/><stop offset="99.43%" stopColor="#0072EC"/></linearGradient>
        <linearGradient id="meta-g4" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stopColor="#007FF9"/><stop offset="100%" stopColor="#007CF6"/></linearGradient>
        <linearGradient id="meta-g5" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stopColor="#007FF9"/><stop offset="100%" stopColor="#0082FB"/></linearGradient>
        <linearGradient id="meta-g6" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stopColor="#007FF8"/><stop offset="91.41%" stopColor="#0082FB"/></linearGradient>
        <linearGradient id="meta-g7" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stopColor="#0082FB"/><stop offset="99.95%" stopColor="#0081FA"/></linearGradient>
        <linearGradient id="meta-g8" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stopColor="#0081FA"/><stop offset="100%" stopColor="#0080F9"/></linearGradient>
        <linearGradient id="meta-g9" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stopColor="#027AF3"/><stop offset="100%" stopColor="#0080F9"/></linearGradient>
        <linearGradient id="meta-g10" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stopColor="#0377EF"/><stop offset="99.94%" stopColor="#0279F1"/></linearGradient>
        <linearGradient id="meta-g11" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stopColor="#0471E9"/><stop offset="100%" stopColor="#0377EF"/></linearGradient>
        <linearGradient id="meta-g12" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stopColor="#0867DF"/><stop offset="100%" stopColor="#0471E9"/></linearGradient>
      </defs>
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
  meta: {
    label: "Meta",

    defaultScopes: "pages_manage_posts,pages_read_engagement,pages_show_list,publish_video",
    devConsole: "https://developers.facebook.com/apps/",
    devConsoleLabel: "Meta for Developers",
    notes: [
      "Create a Business app and add the Facebook Login product.",
      'Add the redirect URI below to "Valid OAuth Redirect URIs".',
      "You must manage at least one Facebook Page to connect.",
      "Request the pages_manage_posts and publish_video permissions.",
    ],
    Icon: MetaIcon,
  },
};

const ICON_COLORS: Record<string, string> = {
  youtube: "bg-red-600",
  tiktok: "bg-gray-900",
  meta: "bg-white/10",
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
