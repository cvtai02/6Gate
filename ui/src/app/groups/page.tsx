"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDestinationIconPath } from "@/lib/destination-icons";
import { TYPE_COLORS, TYPE_ABBR } from "@/lib/destination-types";

/* ── Types ─────────────────────────────────────────────────────────────── */

type GroupDestination = {
  destinationId: string;
  type: string | null;
  providerType: string | null;
  avatarUrl: string | null;
  accountAvatarUrl: string | null;
};

type Group = {
  id: string;
  name: string;
  createdAt: string;
  destinations: GroupDestination[];
};

/* ── Visual helpers ─────────────────────────────────────────────────────── */

function DestBadge({ type, providerType }: { type: string; providerType?: string | null }) {
  const iconPath = getDestinationIconPath(type, providerType);
  if (iconPath) {
    return (
      <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center shrink-0 p-1">
        <img src={iconPath} alt="" className="w-full h-full object-contain" />
      </div>
    );
  }
  const bg = TYPE_COLORS[type] ?? "bg-gray-700";
  const abbr = TYPE_ABBR[type] ?? type.slice(0, 2).toUpperCase();
  return (
    <div className={`w-6 h-6 rounded-md ${bg} flex items-center justify-center shrink-0`}>
      <span className="text-[9px] font-bold text-white">{abbr}</span>
    </div>
  );
}

function DestAvatar({ type, avatarUrl, providerType }: { type: string; avatarUrl?: string | null; providerType?: string | null }) {
  const [errored, setErrored] = useState(false);
  if (avatarUrl && !errored) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="w-6 h-6 rounded-md object-cover shrink-0"
        onError={() => setErrored(true)}
      />
    );
  }
  return <DestBadge type={type} providerType={providerType} />;
}

/* ── Create Group Modal ─────────────────────────────────────────────────── */

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to create group");
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
          <h2 className="text-sm font-semibold text-white">Create Group</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Group Name</label>
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
              disabled={submitting || !name.trim()}
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

/* ── Group row ──────────────────────────────────────────────────────────── */

function GroupRow({ group }: { group: Group }) {
  const MAX_AVATARS = 7;
  const extra = Math.max(0, group.destinations.length - MAX_AVATARS);

  return (
    <Link
      href={`/groups/${group.id}`}
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-white/[.04] transition-colors"
    >
      <span className="text-sm font-medium text-white truncate min-w-0 flex-1">
        {group.name}
      </span>
      {group.destinations.length === 0 ? (
        <span className="text-[11px] text-gray-600 shrink-0">No destinations</span>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          {group.destinations.slice(0, MAX_AVATARS).map((dest) => (
            <DestAvatar
              key={dest.destinationId}
              type={dest.type ?? ""}
              avatarUrl={dest.avatarUrl ?? dest.accountAvatarUrl}
              providerType={dest.providerType}
            />
          ))}
          {extra > 0 && (
            <span className="text-[11px] text-gray-600 ml-0.5">+{extra}</span>
          )}
        </div>
      )}
    </Link>
  );
}

function GroupRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 animate-pulse">
      <div className="h-4 w-36 bg-white/10 rounded" />
      <div className="flex gap-1 ml-auto">
        {[1, 2].map((i) => <div key={i} className="w-5 h-5 rounded-md bg-white/10" />)}
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/groups");
    setGroups(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-8 flex flex-col gap-6 min-h-full">
      {showCreate && (
        <CreateGroupModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Groups</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          + New Group
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] py-1">
          {[1, 2, 3].map((i) => <GroupRowSkeleton key={i} />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-12 text-center">
          <p className="text-sm text-gray-500">No groups yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            + New Group
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] py-1 divide-y divide-[var(--border)]">
          {groups.map((group) => (
            <GroupRow key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
