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
      className="rounded-xl border border-[var(--border)] bg-[var(--muted)] hover:border-gray-500 px-5 py-4 flex items-center gap-4 transition-colors block"
    >
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-white truncate block">
          {group.name}
        </span>

        {group.destinations.length === 0 ? (
          <p className="text-xs text-gray-600 mt-1">No destinations</p>
        ) : (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {group.destinations.slice(0, MAX_AVATARS).map((dest) => (
              <DestAvatar
                key={dest.destinationId}
                type={dest.type ?? ""}
                avatarUrl={dest.avatarUrl ?? dest.accountAvatarUrl}
                providerType={dest.providerType}
              />
            ))}
            {extra > 0 && (
              <span className="text-xs text-gray-600">+{extra}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function GroupRowSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-5 py-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-36 bg-white/10 rounded" />
        <div className="flex gap-1.5">
          {[1, 2, 3].map((i) => <div key={i} className="w-6 h-6 rounded-md bg-white/10" />)}
        </div>
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
        <div>
          <h1 className="text-2xl font-bold text-white">Groups</h1>
          <p className="text-sm text-gray-500 mt-1">Broadcast to multiple platforms at once</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + New Group
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <GroupRowSkeleton key={i} />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--border)] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-white font-medium">No groups yet</p>
          <p className="text-sm text-gray-500 mt-1">Create a group to post to multiple destinations at once.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + New Group
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupRow key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
