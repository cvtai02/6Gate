"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type QueueSettings = {
  uploadTimesInDay: string[];
};

type NextUploadTime = {
  uploadTimesInDay: string[];
  nextUploadAt: string | null;
};

export default function GroupSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const [times, setTimes] = useState<string[]>(["09:00"]);
  const [nextUploadAt, setNextUploadAt] = useState<string | null>(null);
  const [originalTimes, setOriginalTimes] = useState<string[]>(["09:00"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [settingsRes, nextRes] = await Promise.all([
          fetch(`/api/groups/${id}/queue-settings`),
          fetch(`/api/groups/${id}/next-upload-time`),
        ]);
        if (settingsRes.ok && !cancelled) {
          const s: QueueSettings = await settingsRes.json();
          const t = s.uploadTimesInDay ?? ["09:00"];
          setTimes(t);
          setOriginalTimes(t);
        }
        if (nextRes.ok && !cancelled) {
          const n: NextUploadTime = await nextRes.json();
          setNextUploadAt(n.nextUploadAt ?? null);
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  function addTime() {
    setTimes((prev) => [...prev, "12:00"]);
  }

  function removeTime(index: number) {
    setTimes((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTime(index: number, value: string) {
    setTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  const isDirty = JSON.stringify([...times].sort()) !== JSON.stringify([...originalTimes].sort());

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!times.length) { setError("Add at least one upload time."); return; }
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const sorted = [...times].sort();
      const res = await fetch(`/api/groups/${id}/queue-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadTimesInDay: sorted }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save settings");
      } else {
        const t = (data as QueueSettings).uploadTimesInDay ?? sorted;
        setTimes(t);
        setOriginalTimes(t);
        setSaved(true);
        const nextRes = await fetch(`/api/groups/${id}/next-upload-time`);
        if (nextRes.ok) {
          const n: NextUploadTime = await nextRes.json();
          setNextUploadAt(n.nextUploadAt ?? null);
        }
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-lg animate-pulse space-y-4">
        <div className="h-32 bg-white/5 rounded-xl border border-[var(--border)]" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-lg space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">Upload Schedule</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            One queue item dispatches per slot, per day. Local time on the API server.
          </p>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-5">
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Time slots */}
          <div className="space-y-2">
            <label className="block text-xs text-gray-400">Daily upload times (HH:mm)</label>
            {times.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="time"
                  value={t}
                  onChange={(e) => updateTime(i, e.target.value)}
                  required
                  className="bg-black/30 border border-[var(--border)] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
                />
                {times.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTime(i)}
                    className="text-gray-600 hover:text-red-400 text-xs px-2 py-1 transition-colors"
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addTime}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 border border-dashed border-indigo-500/30 hover:border-indigo-500/60 px-3 py-1.5 rounded-lg transition-colors"
            >
              + Add time
            </button>
          </div>

          {/* Preview sorted */}
          {times.length > 1 && (
            <div className="rounded-lg border border-[var(--border)] bg-black/20 px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Will trigger at (local time)</p>
              <p className="text-sm text-white">{[...times].sort().join("  ·  ")}</p>
            </div>
          )}

          {/* Next dispatch */}
          {nextUploadAt && (
            <div className="rounded-lg border border-[var(--border)] bg-black/20 px-4 py-3">
              <p className="text-xs text-gray-500">Next scheduled dispatch</p>
              <p className="text-sm text-white mt-0.5">{new Date(nextUploadAt).toLocaleString()}</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !isDirty || times.length === 0}
              className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="text-xs text-green-400">Saved</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
