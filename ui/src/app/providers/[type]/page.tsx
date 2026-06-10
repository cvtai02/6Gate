"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProviderType } from "@/lib/enums";

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
  avatarUrl: string | null;
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
  if (type === "instagram_account" && accountUsername) return `https://www.instagram.com/${accountUsername}`;
  if (type === "threads_profile" && accountUsername) return `https://www.threads.net/@${accountUsername}`;
  if (type === "TelegramChat" && validId?.startsWith("@")) return `https://t.me/${validId.slice(1)}`;
  return null;
}

const DEST_COLORS: Record<string, string> = {
  youtube_channel: "bg-red-600",
  facebook_page: "bg-blue-700",
  tiktok_account: "bg-gray-800",
  instagram_account: "bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400",
  threads_profile: "bg-black",
  TelegramChat: "bg-sky-500",
};
const DEST_ABBR: Record<string, string> = {
  youtube_channel: "YT",
  facebook_page: "FB",
  tiktok_account: "TK",
  instagram_account: "IG",
  threads_profile: "TH",
  TelegramChat: "TG",
};
const DEST_LABEL: Record<string, string> = {
  youtube_channel: "YouTube Channel",
  facebook_page: "Facebook Page",
  tiktok_account: "TikTok Account",
  instagram_account: "Instagram Account",
  threads_profile: "Threads Profile",
  TelegramChat: "Telegram Chat",
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

function ZernioIcon({ className }: { className?: string }) {
  return (
    <img className={className} src="/icons/zernio.svg" alt="" aria-hidden="true" />
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <img className={className} src="/icons/telegram.svg" alt="" aria-hidden="true" />
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
  zernio: {
    label: "Zernio",
    defaultScopes: "",
    devConsole: "https://docs.zernio.com/llms-full.txt",
    devConsoleLabel: "Zernio API docs",
    notes: [
      "Use Zernio as a combined provider for TikTok, Facebook Pages, Instagram, Telegram, and YouTube.",
      "Add one or more Zernio accounts with API keys, then sync destinations from Zernio.",
    ],
    Icon: ZernioIcon,
  },
  telegram: {
    label: "Telegram",
    defaultScopes: "",
    devConsole: "https://core.telegram.org/bots",
    devConsoleLabel: "Telegram Bot API",
    notes: [
      "Create a bot with BotFather and copy the bot token.",
      "Add the bot to the target group or channel with posting permission.",
      "Optionally add the first chat ID while connecting the bot account.",
    ],
    Icon: TelegramIcon,
  },
};

const ICON_COLORS: Record<string, string> = {
  youtube: "bg-red-600",
  tiktok: "bg-gray-900",
  meta: "bg-white/10",
  zernio: "bg-transparent",
  telegram: "bg-sky-500",
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
  const isApiKeyProvider = type === ProviderType.zernio || type === ProviderType.telegram;
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

          {!isApiKeyProvider && (
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
          )}

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

          {!isApiKeyProvider ? (
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
          ) : (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                {type === ProviderType.zernio ? "Base URL" : "Client ID"}
                <span className="text-gray-600"> (optional)</span>
              </label>
              <input
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
                placeholder={type === ProviderType.zernio ? "https://zernio.com/api/v1" : "optional"}
              />
            </div>
          )}

          {!isApiKeyProvider && (
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
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Save App"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Facebook manual-connect modal ──────────────────────────────────── */

function FacebookManualConnectModal({
  provider,
  onClose,
  onConnected,
}: {
  provider: Provider;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [form, setForm] = useState({
    appId: provider.clientId ?? "",
    appSecret: "",
    accessToken: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    added: number; skipped: number;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/accounts/meta/manual-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: provider.id,
          appId: form.appId,
          appSecret: form.appSecret,
          accessToken: form.accessToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to connect");
      } else {
        setResult(data);
        onConnected();
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
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">Connect Meta Account Manually</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-gray-500">
            Provide a user access token with <code className="text-gray-400">pages_show_list</code> permission.
            The token will be exchanged for a long-lived token. Facebook Pages will be added as destinations.
          </p>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {result && (
            <div className="space-y-1.5">
              <p className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                {result.added === 0
                  ? `${result.skipped} page${result.skipped !== 1 ? "s" : ""} already connected`
                  : `${result.added} page${result.added !== 1 ? "s" : ""} added${result.skipped > 0 ? `, ${result.skipped} already existed` : ""}`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">App ID</label>
              <input
                required
                value={form.appId}
                onChange={(e) => setForm((f) => ({ ...f, appId: e.target.value }))}
                className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors font-mono"
                placeholder="your-app-id"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">App Secret</label>
              <input
                type="password"
                required
                value={form.appSecret}
                onChange={(e) => setForm((f) => ({ ...f, appSecret: e.target.value }))}
                className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
                placeholder="your-app-secret"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">User Access Token</label>
            <textarea
              required
              rows={3}
              value={form.accessToken}
              onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition-colors font-mono resize-none"
              placeholder="EAAxxxxxx..."
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
              disabled={submitting || !!result}
              className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {submitting ? "Connecting…" : result ? "Done" : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ZernioAccountModal({
  provider,
  onClose,
  onConnected,
}: {
  provider: Provider;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [form, setForm] = useState({ name: "Zernio Account", apiKey: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/accounts/zernio/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: provider.id,
          name: form.name,
          apiKey: form.apiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add Zernio account");
      } else {
        onConnected();
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
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">Add Zernio Account</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Account Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">API Key</label>
            <input
              required
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
              placeholder="zernio-api-key"
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
              {submitting ? "Adding…" : "Add Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TelegramAccountModal({
  provider,
  onClose,
  onConnected,
}: {
  provider: Provider;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [form, setForm] = useState({
    name: "Telegram Bot",
    botToken: "",
    chatId: "",
    chatName: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/accounts/telegram/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: provider.id,
          name: form.name,
          botToken: form.botToken,
          chatId: form.chatId || undefined,
          chatName: form.chatName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add Telegram bot");
      } else {
        onConnected();
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
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">Add Telegram Bot</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Bot Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Bot Token</label>
            <input
              required
              type="password"
              value={form.botToken}
              onChange={(e) => setForm((f) => ({ ...f, botToken: e.target.value }))}
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
              placeholder="123456:ABC..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Chat ID</label>
              <input
                value={form.chatId}
                onChange={(e) => setForm((f) => ({ ...f, chatId: e.target.value }))}
                className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
                placeholder="@channel or -100..."
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Chat Name</label>
              <input
                value={form.chatName}
                onChange={(e) => setForm((f) => ({ ...f, chatName: e.target.value }))}
                className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
                placeholder="optional"
              />
            </div>
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
              {submitting ? "Adding…" : "Add Bot"}
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
  const isFacebook = account.providerType === ProviderType.meta;
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
      <div className="flex items-center gap-3 px-4 py-3">
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

        <div className="flex-1 min-w-0">
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
                <div className={`w-4 h-4 rounded ${bg} flex items-center justify-center shrink-0 overflow-hidden`}>
                  {singleDest.avatarUrl ? (
                    <img
                      src={singleDest.avatarUrl}
                      alt={singleDest.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <span className="text-[8px] font-bold text-white">{abbr}</span>
                  )}
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

        <div className="flex items-center gap-2 shrink-0">
          {syncMsg && (
            <span className={`text-xs max-w-[220px] truncate ${
              syncMsg.kind === "error" ? "text-red-400" :
              syncMsg.kind === "warning" ? "text-yellow-400" :
              "text-green-400"
            }`} title={syncMsg.text}>
              {syncMsg.text}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-[var(--border)] hover:border-gray-500 transition-colors disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync"}
          </button>
          <button
            onClick={onDisconnect}
            className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-400/50 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Destinations */}
      {multiDest && (
        <div className="border-t border-[var(--border)] px-4 py-3">
          {destinations.length === 0 ? (
            <p className="text-xs text-gray-600 py-1">
              {isFacebook
                ? <>No destination yet — click <span className="text-gray-400">Sync</span> to fetch the page.</>
                : "No destination yet — try disconnecting and reconnecting this account."}
            </p>
          ) : (() => {
            // Group destinations by type
            const grouped = destinations.reduce<Record<string, Destination[]>>((acc, dest) => {
              (acc[dest.type] ??= []).push(dest);
              return acc;
            }, {});
            const types = Object.keys(grouped);
            const multiCol = types.length > 1;

            return (
              <div
                className={multiCol ? "grid gap-x-6 gap-y-0" : ""}
                style={multiCol ? { gridTemplateColumns: `repeat(${types.length}, 1fr)` } : {}}
              >
                {types.map((destType) => {
                  const group = grouped[destType];
                  const bg = DEST_COLORS[destType] ?? "bg-gray-700";
                  const abbr = DEST_ABBR[destType] ?? destType.slice(0, 2).toUpperCase();
                  const label = DEST_LABEL[destType] ?? destType;
                  return (
                    <div key={destType}>
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2">
                        {label} ({group.length})
                      </p>
                      <div className="space-y-1">
                        {group.map((dest) => {
                          const url = destUrl(dest);
                          return (
                            <div key={dest.id} className="flex items-center gap-2.5 py-1">
                              <div className={`w-6 h-6 rounded-md ${bg} flex items-center justify-center shrink-0 overflow-hidden`}>
                                {dest.avatarUrl ? (
                                  <img
                                    src={dest.avatarUrl}
                                    alt={dest.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                  />
                                ) : (
                                  <span className="text-[9px] font-bold text-white">{abbr}</span>
                                )}
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
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
  const [showManualConnect, setShowManualConnect] = useState(false);
  const [showApiKeyConnect, setShowApiKeyConnect] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const isFacebookProvider = provider.type === ProviderType.meta;
  const isZernioProvider = provider.type === ProviderType.zernio;
  const isTelegramProvider = provider.type === ProviderType.telegram;
  const usesOAuth = !isZernioProvider && !isTelegramProvider;

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      if (isFacebookProvider) {
        const res = await fetch("/api/accounts/meta/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerId: provider.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSyncMsg({ kind: "error", text: data.error ?? "Sync failed" });
        } else {
          const fb = data as { created: number; updated: number; deleted: number };
          const parts = [`+${fb.created}`, `${fb.updated} updated`];
          if (fb.deleted > 0) parts.push(`${fb.deleted} removed`);
          setSyncMsg({ kind: "ok", text: parts.join(", ") });
          onDestinationsChanged();
        }
      } else {
        let totalDests = 0;
        const warnings: string[] = [];
        for (const acc of accounts) {
          const res = await fetch(`/api/accounts/${acc.id}/sync-destinations`, { method: "POST" });
          const data = await res.json();
          if (!res.ok) {
            warnings.push(data.error ?? "Sync failed");
          } else {
            totalDests += data.destinations?.length ?? 0;
            if (data.warning) warnings.push(data.warning);
          }
        }
        if (warnings.length > 0) {
          setSyncMsg({ kind: "error", text: warnings[0] });
        } else {
          setSyncMsg({ kind: "ok", text: `${totalDests} destination${totalDests !== 1 ? "s" : ""} synced` });
        }
        onDestinationsChanged();
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
      {showManualConnect && (
        <FacebookManualConnectModal
          provider={provider}
          onClose={() => setShowManualConnect(false)}
          onConnected={() => {
            setShowManualConnect(false);
            onDestinationsChanged();
          }}
        />
      )}
      {showApiKeyConnect && isZernioProvider && (
        <ZernioAccountModal
          provider={provider}
          onClose={() => setShowApiKeyConnect(false)}
          onConnected={onDestinationsChanged}
        />
      )}
      {showApiKeyConnect && isTelegramProvider && (
        <TelegramAccountModal
          provider={provider}
          onClose={() => setShowApiKeyConnect(false)}
          onConnected={onDestinationsChanged}
        />
      )}

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
          {syncMsg && (
            <span
              className={`text-xs max-w-[260px] truncate ${syncMsg.kind === "error" ? "text-red-400" : "text-green-400"}`}
              title={syncMsg.text}
            >
              {syncMsg.text}
            </span>
          )}
          {accounts.length > 0 && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-[var(--border)] hover:border-gray-500 transition-colors disabled:opacity-50"
            >
              {syncing ? "Syncing…" : "Sync"}
            </button>
          )}
          {isFacebookProvider && (
            <button
              onClick={() => setShowManualConnect(true)}
              className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-[var(--border)] hover:border-indigo-500/50 transition-colors"
              title="Add account using an access token instead of OAuth"
            >
              + Add Manually
            </button>
          )}
          {usesOAuth ? (
            <button
              onClick={() => onConnect(provider.id)}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              + Connect Account
            </button>
          ) : (
            <button
              onClick={() => setShowApiKeyConnect(true)}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              + Add Account
            </button>
          )}
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
              onClick={() => usesOAuth ? onConnect(provider.id) : setShowApiKeyConnect(true)}
              className="mt-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              {usesOAuth ? "+ Add Connection" : "+ Add Account"}
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
      fetch(`/api/accounts?type=${encodeURIComponent(type)}`),
      fetch(`/api/publish-destinations?type=${encodeURIComponent(type)}`),
    ]);
    const allProviders: Provider[] = await provRes.json();
    const providerAccounts: Account[] = await accRes.json();
    const providerDests: Destination[] = await destRes.json();
    setProviders(allProviders.filter((p) => p.type === type));
    setAccounts(providerAccounts);
    setDestinations(providerDests);
  }

  useEffect(() => {
    load();
    if (searchParams.get("connected")) {
      setFlash({ kind: "success", msg: "Account connected successfully!" });
      const accountId = searchParams.get("accountId");
      if (type === "tiktok" && accountId) {
        fetch(`/api/accounts/${accountId}/sync`, { method: "POST" })
          .then((r) => r.json())
          .then((data) => { if (data.ok) load(); })
          .catch(() => {});
      }
      router.replace(`/providers/${type}`);
    }
    if (searchParams.get("error")) {
      setFlash({ kind: "error", msg: decodeURIComponent(searchParams.get("error")!) });
      router.replace(`/providers/${type}`);
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
