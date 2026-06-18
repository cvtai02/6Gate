"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";

type Group = { id: string; name: string };

export default function GroupDetailLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const [group, setGroup] = useState<Group | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((groups: Group[]) => {
        const g = groups.find((g) => g.id === id) ?? null;
        setGroup(g);
        setDraft(g?.name ?? "");
      })
      .catch(() => {});
  }, [id]);

  async function saveName() {
    if (!draft.trim() || !group || draft.trim() === group.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.trim() }),
      });
      if (res.ok) setGroup((g) => (g ? { ...g, name: draft.trim() } : g));
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  const base = `/groups/${id}`;
  const tabs = [
    { label: "Overview", href: base },
    { label: "Queue", href: `${base}/queue` },
    { label: "Settings", href: `${base}/settings` },
  ];

  function isActive(href: string) {
    return href === base ? pathname === base : pathname.startsWith(href);
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-8 pt-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 mb-5">
          <Link href="/groups" className="text-sm text-gray-500 hover:text-white transition-colors">
            Groups
          </Link>
          <span className="text-gray-700">/</span>
          {editing ? (
            <>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") { setDraft(group?.name ?? ""); setEditing(false); }
                }}
                className="bg-black/40 border border-indigo-500 rounded-md px-2 py-0.5 text-sm text-white focus:outline-none w-52 min-w-0"
              />
              <button
                onClick={saveName}
                disabled={saving}
                className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
              >
                {saving ? "…" : "✓"}
              </button>
              <button
                onClick={() => { setDraft(group?.name ?? ""); setEditing(false); }}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                ✕
              </button>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-white">
                {group ? group.name : <span className="text-gray-600 italic text-sm">Loading…</span>}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="text-gray-600 hover:text-gray-400 text-xs"
                title="Rename group"
              >
                ✏
              </button>
            </>
          )}
        </div>

        <nav className="flex -mb-px">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${
                isActive(tab.href)
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
