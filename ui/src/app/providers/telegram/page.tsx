"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Provider = {
  id: string;
  name: string;
  type: string;
  clientId: string | null;
  createdAt: string;
};

type Account = {
  id: string;
  providerId: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
  providerType: string | null;
};

type Destination = {
  id: string;
  socialAccountId: string;
  name: string;
  type: string;
  externalId: string | null;
};

function TelegramIcon({ className }: { className?: string }) {
  return (
    <img className={className} src="/icons/telegram.svg" alt="" aria-hidden="true" />
  );
}

/* ── Configure provider modal ──────────────────────────────────────────── */

function ConfigureAppModal({
  existing,
  onClose,
  onSaved,
}: {
  existing?: Provider;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name ?? "Telegram Notifications");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const url = isEdit ? `/api/providers/${existing!.id}` : "/api/providers";
      const method = isEdit ? "PATCH" : "POST";
      const body: Record<string, unknown> = { name };
      if (!isEdit) body.type = "telegram";
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
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">{isEdit ? "Edit" : "Configure"} Telegram</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="rounded-lg bg-black/20 border border-[var(--border)] p-4 space-y-1.5">
            <a
              href="https://core.telegram.org/bots"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mb-1"
            >
              → Open Telegram Bot API docs ↗
            </a>
            <p className="text-xs text-gray-500">1. Create a bot with BotFather and copy the bot token.</p>
            <p className="text-xs text-gray-500">2. Add the bot to your notification group/channel.</p>
            <p className="text-xs text-gray-500">3. Add bot accounts below, then assign them to groups.</p>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[var(--border)] rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors">
              {submitting ? "Saving…" : isEdit ? "Save" : "Configure"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Add bot modal ─────────────────────────────────────────────────────── */

function AddBotModal({
  provider,
  onClose,
  onAdded,
}: {
  provider: Provider;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({ name: "Telegram Bot", botToken: "", chatId: "", chatName: "" });
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
        setError(data.error ?? "Failed to add bot");
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
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">Add Telegram Bot</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
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
              <label className="block text-xs text-gray-400 mb-1.5">Chat ID <span className="text-gray-600">(optional)</span></label>
              <input
                value={form.chatId}
                onChange={(e) => setForm((f) => ({ ...f, chatId: e.target.value }))}
                className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
                placeholder="@channel or -100..."
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Chat Name <span className="text-gray-600">(optional)</span></label>
              <input
                value={form.chatName}
                onChange={(e) => setForm((f) => ({ ...f, chatName: e.target.value }))}
                className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
                placeholder="optional"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[var(--border)] rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors">
              {submitting ? "Adding…" : "Add Bot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Bot account row ───────────────────────────────────────────────────── */

function BotRow({
  account,
  destinations,
  onDisconnect,
  onRename,
  onSync,
}: {
  account: Account;
  destinations: Destination[];
  onDisconnect: () => void;
  onRename: (name: string) => Promise<void>;
  onSync: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(account.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ kind: "success" | "warn"; text: string } | null>(null);
  const displayName = account.displayName ?? account.username ?? account.id;

  async function save() {
    if (!draft.trim() || draft === account.displayName) { setEditing(false); return; }
    setSaving(true);
    await onRename(draft.trim());
    setSaving(false);
    setEditing(false);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`/api/accounts/${account.id}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncMsg({ kind: "warn", text: data.message ?? data.error ?? "Sync failed" });
      } else if (data.warning) {
        setSyncMsg({ kind: "warn", text: data.warning });
      } else {
        setSyncMsg({ kind: "success", text: `Found ${data.discovered} chat${data.discovered !== 1 ? "s" : ""} (${data.created} new, ${data.updated} updated)` });
      }
      await onSync();
    } catch {
      setSyncMsg({ kind: "warn", text: "Sync request failed" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-black/20 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-sky-600/30 border border-sky-500/30 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-sky-400">
            {displayName.charAt(0).toUpperCase()}
          </span>
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
              <button onClick={() => { setDraft(account.displayName ?? ""); setEditing(false); }} className="text-xs text-gray-500 hover:text-gray-300 shrink-0">
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
                onClick={() => { setDraft(account.displayName ?? ""); setEditing(true); }}
                className="text-gray-600 hover:text-gray-400 text-xs shrink-0"
                title="Rename"
              >
                ✏
              </button>
            </div>
          )}
          {destinations.length > 0 && !editing && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {destinations.map((dest) => (
                <span key={dest.id} className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                  {dest.name}
                </span>
              ))}
            </div>
          )}
          {syncMsg && (
            <p className={`text-xs mt-1 ${syncMsg.kind === "success" ? "text-green-400" : "text-yellow-400"}`}>
              {syncMsg.text}
            </p>
          )}
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-xs text-sky-400 hover:text-sky-300 px-3 py-1.5 rounded-lg border border-sky-500/30 hover:border-sky-400/50 transition-colors shrink-0 disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync Chats"}
        </button>
        <button
          onClick={onDisconnect}
          className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-400/50 transition-colors shrink-0"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function TelegramNotificationsPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [showConfigure, setShowConfigure] = useState<Provider | null | "new">(null);
  const [showAddBot, setShowAddBot] = useState(false);

  async function load() {
    const [provRes, accRes, destRes] = await Promise.all([
      fetch("/api/providers"),
      fetch("/api/accounts?type=telegram"),
      fetch("/api/publish-destinations?type=telegram"),
    ]);
    const allProviders: Provider[] = await provRes.json();
    setProviders(allProviders.filter((p) => p.type === "telegram"));
    setAccounts(await accRes.json());
    setDestinations(await destRes.json());
  }

  useEffect(() => { load(); }, []);

  async function handleDisconnect(accountId: string) {
    if (!confirm("Disconnect this bot?")) return;
    await fetch(`/api/accounts/${accountId}`, { method: "DELETE" });
    await load();
  }

  async function handleRename(accountId: string, displayName: string) {
    await fetch(`/api/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    await load();
  }

  async function handleDeleteProvider(id: string) {
    if (!confirm("Remove this configuration? Connected bots will also be removed.")) return;
    await fetch(`/api/providers/${id}`, { method: "DELETE" });
    await load();
  }

  const provider = providers[0];
  const totalBots = accounts.length;

  return (
    <div className="p-8 flex flex-col gap-6 min-h-full">
      {showConfigure !== null && (
        <ConfigureAppModal
          existing={showConfigure === "new" ? undefined : showConfigure}
          onClose={() => setShowConfigure(null)}
          onSaved={load}
        />
      )}
      {showAddBot && provider && (
        <AddBotModal
          provider={provider}
          onClose={() => setShowAddBot(false)}
          onAdded={load}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => router.push("/providers")} className="hover:text-white transition-colors">
          Providers
        </button>
        <span>›</span>
        <span className="text-white">Telegram</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-500 flex items-center justify-center shrink-0">
            <TelegramIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Telegram</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalBots === 0
                ? "No bots connected"
                : `${totalBots} bot${totalBots !== 1 ? "s" : ""} connected`}
            </p>
          </div>
        </div>
        {!provider ? (
          <button
            onClick={() => setShowConfigure("new")}
            className="text-sm border border-[var(--border)] hover:border-indigo-500/50 text-gray-400 hover:text-white px-4 py-2 rounded-lg transition-colors"
          >
            + Configure
          </button>
        ) : (
          <button
            onClick={() => setShowConfigure(provider)}
            className="text-sm border border-[var(--border)] hover:border-indigo-500/50 text-gray-400 hover:text-white px-4 py-2 rounded-lg transition-colors"
          >
            Edit Config
          </button>
        )}
      </div>

      {/* No provider configured */}
      {!provider ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--border)] flex items-center justify-center mx-auto mb-3">
            <TelegramIcon className="w-6 h-6" />
          </div>
          <p className="text-white font-medium">Telegram not configured</p>
          <p className="text-sm text-gray-500 mt-1">
            Configure Telegram to receive upload notifications in your group chats.
          </p>
          <button
            onClick={() => setShowConfigure("new")}
            className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Configure Telegram
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Provider info bar */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{provider.name}</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Bots added here can be assigned to groups for upload notifications.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddBot(true)}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                + Add Bot
              </button>
              <button
                onClick={() => handleDeleteProvider(provider.id)}
                className="text-xs text-gray-500 hover:text-red-400 px-2 py-1.5 rounded-lg border border-[var(--border)] hover:border-red-500/30 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Bot accounts */}
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Bots
          </h2>
          {accounts.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] py-8 text-center">
              <p className="text-sm text-gray-500">No bots connected yet</p>
              <p className="text-xs text-gray-600 mt-0.5">Add a bot to start receiving notifications</p>
              <button
                onClick={() => setShowAddBot(true)}
                className="mt-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors"
              >
                + Add Bot
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((acc) => (
                <BotRow
                  key={acc.id}
                  account={acc}
                  destinations={destinations.filter((d) => d.socialAccountId === acc.id)}
                  onDisconnect={() => handleDisconnect(acc.id)}
                  onRename={(name) => handleRename(acc.id, name)}
                  onSync={load}
                />
              ))}
            </div>
          )}

          {/* Usage hint */}
          <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/20 p-4">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-1">How to use</p>
            <p className="text-xs text-gray-500">
              After adding a bot, go to any Group → configure the <span className="text-gray-300">Telegram Notify</span> section
              to select which bot and chat ID should receive notifications when uploads complete.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
