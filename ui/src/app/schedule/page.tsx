"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ScheduleItem = {
  groupId: string;
  groupName: string;
  uploadTimesInDay: string[];
  pendingCount: number;
  failedCount: number;
  nextUploadAt: string | null;
  lastTriggeredDate: string | null;
};

type FailedQueueItem = {
  id: string;
  groupId: string;
  groupName: string;
  videoPath: string;
  title: string | null;
  errorMessage: string | null;
  updatedAt: string;
};

type HistoryJob = {
  id: string;
  status: string;
  providerPostUrl: string | null;
  errorMessage: string | null;
  destinationName: string | null;
  destinationType: string | null;
  destinationIcon: string | null;
};

type HistoryBatch = {
  id: string;
  groupId: string | null;
  groupName: string | null;
  title: string | null;
  videoPath: string | null;
  createdAt: string;
  updatedAt: string;
  jobs: HistoryJob[];
};

const GROUP_COLORS = [
  { bg: "bg-indigo-500/20", border: "border-indigo-500/40", text: "text-indigo-300", dot: "bg-indigo-400" },
  { bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-300", dot: "bg-emerald-400" },
  { bg: "bg-amber-500/20", border: "border-amber-500/40", text: "text-amber-300", dot: "bg-amber-400" },
  { bg: "bg-rose-500/20", border: "border-rose-500/40", text: "text-rose-300", dot: "bg-rose-400" },
  { bg: "bg-cyan-500/20", border: "border-cyan-500/40", text: "text-cyan-300", dot: "bg-cyan-400" },
  { bg: "bg-violet-500/20", border: "border-violet-500/40", text: "text-violet-300", dot: "bg-violet-400" },
  { bg: "bg-orange-500/20", border: "border-orange-500/40", text: "text-orange-300", dot: "bg-orange-400" },
  { bg: "bg-pink-500/20", border: "border-pink-500/40", text: "text-pink-300", dot: "bg-pink-400" },
];

const HISTORY_STATUS_DOT: Record<string, string> = {
  Published: "bg-green-400",
  Failed: "bg-red-400",
  Cancelled: "bg-gray-500",
  Created: "bg-yellow-400",
  Uploading: "bg-indigo-400",
  Processing: "bg-indigo-400",
  Retrying: "bg-amber-400",
};

function getWeekDays(baseDate: Date): Date[] {
  const start = new Date(baseDate);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDayHeader(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function dateDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function batchStatusDot(batch: HistoryBatch): string {
  if (batch.jobs.some((j) => j.status === "Failed")) return "bg-red-400";
  if (batch.jobs.every((j) => j.status === "Published")) return "bg-green-400";
  if (batch.jobs.some((j) => ["Uploading", "Processing", "Initializing", "Finishing", "Retrying"].includes(j.status))) return "bg-indigo-400 animate-pulse";
  return "bg-yellow-400";
}

function getDispatchSlots(schedule: ScheduleItem, weekDays: Date[]): Set<string> {
  const slots = new Set<string>();
  if (!schedule.nextUploadAt || schedule.pendingCount <= 0 || schedule.uploadTimesInDay.length === 0) return slots;

  const nextUpload = new Date(schedule.nextUploadAt);
  const sortedTimes = [...schedule.uploadTimesInDay].sort();
  const weekEnd = new Date(weekDays[6]);
  weekEnd.setHours(23, 59, 59, 999);

  let remaining = schedule.pendingCount;
  const cursor = new Date(weekDays[0]);
  cursor.setHours(0, 0, 0, 0);

  while (remaining > 0 && cursor <= weekEnd) {
    const dayStr = dateDayKey(cursor);
    for (const time of sortedTimes) {
      if (remaining <= 0) break;
      const [h, m] = time.split(":").map(Number);
      const slotDate = new Date(cursor);
      slotDate.setHours(h, m, 0, 0);
      if (slotDate < nextUpload) continue;
      if (slotDate > weekEnd) break;
      slots.add(`${dayStr}|${time}`);
      remaining--;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60;

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [failedQueueItems, setFailedQueueItems] = useState<FailedQueueItem[]>([]);
  const [historyBatches, setHistoryBatches] = useState<HistoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/schedules").then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch("/api/history?limit=500").then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    ])
      .then(([sched, hist]) => {
        setSchedules(sched.schedules ?? sched);
        setFailedQueueItems(sched.failedQueueItems ?? []);
        setHistoryBatches(hist.batches ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDays = getWeekDays(baseDate);
  const weekDayKeys = new Set(weekDays.map(dateDayKey));

  const schedulesWithQueue = schedules.filter((s) => s.pendingCount > 0);
  const schedulesWithFailed = schedules.filter((s) => s.failedCount > 0);

  const allGroupIds = new Set<string>();
  schedulesWithQueue.forEach((s) => allGroupIds.add(s.groupId));
  schedulesWithFailed.forEach((s) => allGroupIds.add(s.groupId));
  historyBatches.forEach((b) => { if (b.groupId) allGroupIds.add(b.groupId); });

  const groupColors = new Map<string, (typeof GROUP_COLORS)[number]>();
  let colorIdx = 0;
  for (const gid of allGroupIds) {
    groupColors.set(gid, GROUP_COLORS[colorIdx % GROUP_COLORS.length]);
    colorIdx++;
  }

  const activeSchedules = selectedGroupIds
    ? schedulesWithQueue.filter((s) => selectedGroupIds.has(s.groupId))
    : schedulesWithQueue;

  const activeHistory = selectedGroupIds
    ? historyBatches.filter((b) => b.groupId && selectedGroupIds.has(b.groupId))
    : historyBatches;

  const activeFailedItems = selectedGroupIds
    ? failedQueueItems.filter((f) => selectedGroupIds.has(f.groupId))
    : failedQueueItems;

  // Group failed queue items by day key for the current week
  const failedByDay = new Map<string, FailedQueueItem[]>();
  for (const item of activeFailedItems) {
    const d = new Date(item.updatedAt);
    const key = dateDayKey(d);
    if (!weekDayKeys.has(key)) continue;
    const list = failedByDay.get(key) ?? [];
    list.push(item);
    failedByDay.set(key, list);
  }

  // Group history batches by day key for the current week
  const historyByDay = new Map<string, HistoryBatch[]>();
  for (const batch of activeHistory) {
    const d = new Date(batch.createdAt);
    const key = dateDayKey(d);
    if (!weekDayKeys.has(key)) continue;
    const list = historyByDay.get(key) ?? [];
    list.push(batch);
    historyByDay.set(key, list);
  }

  // Collect all group names for the legend
  const allGroupNames = new Map<string, string>();
  schedulesWithQueue.forEach((s) => allGroupNames.set(s.groupId, s.groupName));
  historyBatches.forEach((b) => { if (b.groupId && b.groupName) allGroupNames.set(b.groupId, b.groupName); });

  function toggleGroup(groupId: string) {
    setSelectedGroupIds((prev) => {
      if (prev === null) {
        const next = new Set(allGroupIds);
        next.delete(groupId);
        return next;
      }
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      if (next.size === allGroupIds.size) return null;
      return next;
    });
  }

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const hasContent = activeSchedules.length > 0 || activeHistory.length > 0 || activeFailedItems.length > 0;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Schedule</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-[var(--border)] rounded-lg hover:border-gray-500 transition-colors"
          >
            &larr; Prev
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/60 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-[var(--border)] rounded-lg hover:border-gray-500 transition-colors"
          >
            Next &rarr;
          </button>
        </div>
      </div>

      {/* Legend — click to toggle filter */}
      {allGroupNames.size > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 mr-1">Filter:</span>
          <button
            onClick={() => setSelectedGroupIds(null)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
              selectedGroupIds === null
                ? "border-indigo-500/40 bg-indigo-500/20 text-indigo-300"
                : "border-[var(--border)] text-gray-500 hover:text-gray-300 hover:border-gray-500"
            }`}
          >
            All
          </button>
          {[...allGroupNames.entries()].map(([gid, name]) => {
            const c = groupColors.get(gid)!;
            const isActive = selectedGroupIds === null || selectedGroupIds.has(gid);
            return (
              <button
                key={gid}
                onClick={() => toggleGroup(gid)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                  isActive
                    ? `${c.bg} ${c.text} ${c.border}`
                    : "border-[var(--border)] text-gray-600 bg-transparent opacity-50"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isActive ? c.dot : "bg-gray-600"}`} />
                {name}
              </button>
            );
          })}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Loading schedule...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && !hasContent && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-10 text-center">
          <p className="text-sm text-gray-500">No scheduled uploads or history.</p>
          <p className="text-xs text-gray-600 mt-1">Add items to a group's queue to see them on the calendar.</p>
        </div>
      )}

      {!loading && !error && hasContent && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[var(--border)]">
            <div className="p-2" />
            {weekDays.map((day, i) => (
              <div
                key={i}
                className={`p-2 text-center text-xs font-medium border-l border-[var(--border)] ${
                  isToday(day) ? "text-indigo-400 bg-indigo-500/5" : "text-gray-400"
                }`}
              >
                {formatDayHeader(day)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[60px_repeat(7,1fr)] overflow-y-auto max-h-[calc(100vh-300px)]" style={{ minHeight: HOURS.length * HOUR_HEIGHT }}>
            {/* Time labels */}
            <div className="relative">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 text-right pr-2 text-[10px] text-gray-600"
                  style={{ top: hour * HOUR_HEIGHT - 6 }}
                >
                  {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day, dayIdx) => {
              const todayCol = isToday(day);
              const dayStr = dateDayKey(day);
              const dayHistory = historyByDay.get(dayStr) ?? [];

              return (
                <div key={dayIdx} className={`relative border-l border-[var(--border)] ${todayCol ? "bg-indigo-500/[.02]" : ""}`}>
                  {/* Hour grid lines */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-[var(--border)]"
                      style={{ top: hour * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Current time indicator */}
                  {todayCol && weekOffset === 0 && (
                    <div
                      className="absolute left-0 right-0 z-20 flex items-center"
                      style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                      <div className="flex-1 h-px bg-red-500/60" />
                    </div>
                  )}

                  {/* History batches — show as cards at their creation time */}
                  {(() => {
                    const blockH = 34;
                    const gap = 2;
                    const stride = blockH + gap;
                    // Anchor at the earliest batch's time, stack the rest below
                    const sorted = [...dayHistory].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
                    const anchorMins = sorted.length > 0 ? (() => { const d = new Date(sorted[0].createdAt); return d.getHours() * 60 + d.getMinutes(); })() : 0;
                    const anchorTop = (anchorMins / 60) * HOUR_HEIGHT;

                    return sorted.map((batch, idx) => {
                      const created = new Date(batch.createdAt);
                      const c = batch.groupId ? groupColors.get(batch.groupId) : null;
                      const statusDot = batchStatusDot(batch);
                      const label = [batch.groupName, batch.title].filter(Boolean).join(" - ") || "Upload";
                      const timeStr = created.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

                      return (
                        <Link
                          key={batch.id}
                          href={`/schedule/batch/${batch.id}`}
                          className={`absolute left-1 right-1 z-10 rounded-md border px-1.5 py-0.5 flex flex-col justify-center hover:opacity-80 transition-opacity ${
                            c ? `${c.bg} ${c.border} ${c.text}` : "bg-gray-500/20 border-gray-500/40 text-gray-300"
                          }`}
                          style={{ top: anchorTop + idx * stride, height: blockH }}
                          title={`${label}\n${batch.jobs.length} job${batch.jobs.length !== 1 ? "s" : ""} — ${timeStr}`}
                        >
                          <span className="flex items-center gap-1 text-[10px] leading-none truncate">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
                            <span className="truncate">{label}</span>
                          </span>
                          <span className="text-[9px] opacity-60 ml-3 leading-none mt-0.5">{timeStr}</span>
                        </Link>
                      );
                    });
                  })()}

                  {/* Failed queue items — show as red cards at their failure time */}
                  {(() => {
                    const dayFailed = failedByDay.get(dayStr) ?? [];
                    const blockH = 34;
                    const gap = 2;
                    const stride = blockH + gap;
                    const sorted = [...dayFailed].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
                    const anchorMins = sorted.length > 0 ? (() => { const d = new Date(sorted[0].updatedAt); return d.getHours() * 60 + d.getMinutes(); })() : 0;
                    const anchorTop = (anchorMins / 60) * HOUR_HEIGHT;

                    return sorted.map((item, idx) => {
                      const failedAt = new Date(item.updatedAt);
                      const label = [item.groupName, item.title].filter(Boolean).join(" - ") || "Queue item";
                      const timeStr = failedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

                      return (
                        <Link
                          key={item.id}
                          href={`/groups/${item.groupId}/queue`}
                          className="absolute left-1 right-1 z-10 rounded-md border px-1.5 py-0.5 flex flex-col justify-center hover:opacity-80 transition-opacity bg-red-500/15 border-red-500/40 text-red-300"
                          style={{ top: anchorTop + idx * stride, height: blockH }}
                          title={`${label}\nFailed: ${item.errorMessage ?? "Unknown error"}\n${timeStr}`}
                        >
                          <span className="flex items-center gap-1 text-[10px] leading-none truncate">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-red-400" />
                            <span className="truncate">{label}</span>
                          </span>
                          <span className="text-[9px] opacity-60 ml-3 leading-none mt-0.5">{timeStr} — failed</span>
                        </Link>
                      );
                    });
                  })()}

                  {/* Future schedule slots */}
                  {(() => {
                    const slotGroups = new Map<string, { s: ScheduleItem; idx: number }[]>();
                    activeSchedules.forEach((s) => {
                      if (!s.nextUploadAt || s.pendingCount <= 0) return;
                      const dispatchSlots = getDispatchSlots(s, weekDays);
                      s.uploadTimesInDay.forEach((time) => {
                        const key = `${dayStr}|${time}`;
                        if (!dispatchSlots.has(key)) return;
                        if (!slotGroups.has(time)) slotGroups.set(time, []);
                        slotGroups.get(time)!.push({ s, idx: slotGroups.get(time)!.length });
                      });
                    });
                    return [...slotGroups.entries()].flatMap(([time, items]) => {
                      const minutes = timeToMinutes(time);
                      const baseTop = (minutes / 60) * HOUR_HEIGHT;
                      const blockHeight = 18;
                      return items.map(({ s, idx }) => {
                        const c = groupColors.get(s.groupId)!;
                        return (
                          <Link
                            key={`${s.groupId}-${time}`}
                            href={`/groups/${s.groupId}`}
                            className={`absolute left-1 right-1 z-10 rounded-md border px-1.5 py-0.5 text-[10px] leading-tight truncate hover:opacity-80 transition-opacity border-dashed ${c.bg} ${c.border} ${c.text}`}
                            style={{ top: baseTop + idx * blockHeight, height: blockHeight }}
                            title={`${s.groupName} — ${formatTime12h(time)} (scheduled, ${s.pendingCount} queued)`}
                          >
                            <span className="opacity-60">⏱</span> {s.groupName}
                          </Link>
                        );
                      });
                    });
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
