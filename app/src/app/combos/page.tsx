"use client";

import { useEffect, useState } from "react";

/* ── Types ──────────────────────────────────────────────────────────────── */

type ComboDestination = {
  destinationId: string;
  name: string | null;
  type: string | null;
  externalId: string | null;
  socialAccountId: string | null;
  providerType: string | null;
  providerName: string | null;
};

type Combo = {
  id: string;
  name: string;
  createdAt: string;
  destinations: ComboDestination[];
};

type PublishDestination = {
  id: string;
  name: string;
  type: string;
  externalId: string | null;
  socialAccountId: string;
  providerType: string | null;
  providerName: string | null;
  accountUsername: string | null;
};

/* ── Type → visual mapping ───────────────────────────────────────────────── */

const TYPE_COLORS: Record<string, string> = {
  youtube_channel: "bg-red-600",
  facebook_page: "bg-blue-700",
  tiktok_account: "bg-gray-800",
  instagram_account: "bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400",
};

const TYPE_ABBR: Record<string, string> = {
  youtube_channel: "YT",
  facebook_page: "FB",
  tiktok_account: "TK",
  instagram_account: "IG",
};

const TYPE_LABEL: Record<string, string> = {
  youtube_channel: "YouTube Channel",
  facebook_page: "Facebook Page",
  tiktok_account: "TikTok",
  instagram_account: "Instagram",
};

function DestBadge({ type }: { type: string }) {
  const bg = TYPE_COLORS[type] ?? "bg-gray-700";
  const abbr = TYPE_ABBR[type] ?? type.slice(0, 2).toUpperCase();
  return (
    <div className={`w-7 h-7 rounded-md ${bg} flex items-center justify-center shrink-0`}>
      <span className="text-[10px] font-bold text-white">{abbr}</span>
    </div>
  );
}

/* ── Create Combo Modal ──────────────────────────────────────────────────── */

function CreateComboModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed");
      } else {
        onCreated();
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
          <h2 className="text-sm font-semibold text-white">Create Combo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Combo Name</label>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. All Platforms"
              className="w-full bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
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
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Add Destination Modal ───────────────────────────────────────────────── */

function AddDestinationModal({
  comboId,
  existingDestinationIds,
  allDestinations,
  onClose,
  onAdded,
}: {
  comboId: string;
  existingDestinationIds: Set<string>;
  allDestinations: PublishDestination[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const available = allDestinations.filter((d) => !existingDestinationIds.has(d.id));

  async function addDestination(destinationId: string) {
    setAdding(destinationId);
    await fetch(`/api/combos/${comboId}/destinations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinationId }),
    });
    setAdding(null);
    onAdded();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">Add Destination</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-3 max-h-80 overflow-y-auto">
          {available.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-6">All destinations are already in this combo.</p>
          ) : (
            <div className="space-y-1">
              {available.map((dest) => (
                <button
                  key={dest.id}
                  onClick={() => addDestination(dest.id)}
                  disabled={adding === dest.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                >
                  <DestBadge type={dest.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{dest.name}</p>
                    <p className="text-xs text-gray-500">{TYPE_LABEL[dest.type] ?? dest.type}</p>
                  </div>
                  {adding === dest.id && (
                    <span className="text-xs text-gray-500">Adding…</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Combo Card ──────────────────────────────────────────────────────────── */

function ComboCard({
  combo,
  allDestinations,
  onDelete,
  onUpdate,
}: {
  combo: Combo;
  allDestinations: PublishDestination[];
  onDelete: () => void;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(combo.name);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  async function saveName() {
    if (!draft.trim() || draft === combo.name) { setEditing(false); return; }
    setSaving(true);
    await fetch(`/api/combos/${combo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.trim() }),
    });
    setSaving(false);
    setEditing(false);
    onUpdate();
  }

  async function removeDestination(destinationId: string) {
    await fetch(`/api/combos/${combo.id}/destinations/${destinationId}`, { method: "DELETE" });
    onUpdate();
  }

  const existingIds = new Set(combo.destinations.map((d) => d.destinationId));

  return (
    <>
      {showAddModal && (
        <AddDestinationModal
          comboId={combo.id}
          existingDestinationIds={existingIds}
          allDestinations={allDestinations}
          onClose={() => setShowAddModal(false)}
          onAdded={onUpdate}
        />
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          {editing ? (
            <div className="flex items-center gap-2 flex-1 mr-2">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") { setDraft(combo.name); setEditing(false); }
                }}
                className="flex-1 bg-black/40 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
              />
              <button onClick={saveName} disabled={saving} className="text-xs text-indigo-400 hover:text-indigo-300">
                {saving ? "…" : "✓"}
              </button>
              <button
                onClick={() => { setDraft(combo.name); setEditing(false); }}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white">{combo.name}</p>
              <button
                onClick={() => { setDraft(combo.name); setEditing(true); }}
                className="text-gray-600 hover:text-gray-400 text-xs"
                title="Rename"
              >
                ✏
              </button>
            </div>
          )}
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-300 px-2.5 py-1 rounded-lg border border-red-500/30 hover:border-red-400/50 transition-colors shrink-0"
          >
            Delete
          </button>
        </div>

        {/* Destinations */}
        <div className="p-3 space-y-2">
          {combo.destinations.length === 0 ? (
            <div className="py-5 text-center">
              <p className="text-sm text-gray-500">No destinations in this combo</p>
              <p className="text-xs text-gray-600 mt-0.5">Add destinations to post to multiple platforms at once</p>
            </div>
          ) : (
            combo.destinations.map((dest) => {
              const type = dest.type ?? "";
              return (
                <div
                  key={dest.destinationId}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-black/20"
                >
                  <DestBadge type={type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{dest.name}</p>
                    <p className="text-xs text-gray-500">{TYPE_LABEL[type] ?? type}</p>
                  </div>
                  <button
                    onClick={() => removeDestination(dest.destinationId)}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors shrink-0"
                    title="Remove from combo"
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-indigo-400 hover:text-indigo-300 border border-dashed border-indigo-500/30 hover:border-indigo-500/60 rounded-lg transition-colors"
          >
            + Add Destination
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function CombosPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [allDestinations, setAllDestinations] = useState<PublishDestination[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    const [comboRes, destRes] = await Promise.all([
      fetch("/api/combos"),
      fetch("/api/publish-destinations"),
    ]);
    setCombos(await comboRes.json());
    setAllDestinations(await destRes.json());
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this combo?")) return;
    await fetch(`/api/combos/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="p-8 flex flex-col gap-6 min-h-full">
      {showCreate && (
        <CreateComboModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Combos</h1>
          <p className="text-sm text-gray-500 mt-1">Group destinations to post to multiple platforms at once</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + Create Combo
        </button>
      </div>

      {/* Content */}
      {combos.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--border)] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-white font-medium">No combos yet</p>
          <p className="text-sm text-gray-500 mt-1">Create a combo to post to multiple destinations at once.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Create Combo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {combos.map((combo) => (
            <ComboCard
              key={combo.id}
              combo={combo}
              allDestinations={allDestinations}
              onDelete={() => handleDelete(combo.id)}
              onUpdate={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
