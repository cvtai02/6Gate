"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ScheduleItem = {
  groupId: string;
  groupName: string;
  uploadTimesInDay: string[];
  pendingCount: number;
  nextUploadAt: string | null;
  lastTriggeredDate: string | null;
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
    const dayStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    fetch("/api/schedules")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setSchedules)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDays = getWeekDays(baseDate);

  const schedulesWithQueue = schedules.filter((s) => s.pendingCount > 0);

  const groupColors = new Map<string, (typeof GROUP_COLORS)[number]>();
  schedulesWithQueue.forEach((s, i) => groupColors.set(s.groupId, GROUP_COLORS[i % GROUP_COLORS.length]));

  const activeSchedules = selectedGroupIds
    ? schedulesWithQueue.filter((s) => selectedGroupIds.has(s.groupId))
    : schedulesWithQueue;

  function toggleGroup(groupId: string) {
    setSelectedGroupIds((prev) => {
      if (prev === null) {
        const next = new Set(schedulesWithQueue.map((s) => s.groupId));
        next.delete(groupId);
        return next;
      }
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      if (next.size === schedulesWithQueue.length) return null;
      return next;
    });
  }

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

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
      {schedulesWithQueue.length > 0 && (
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
          {schedulesWithQueue.map((s) => {
            const c = groupColors.get(s.groupId)!;
            const isActive = selectedGroupIds === null || selectedGroupIds.has(s.groupId);
            return (
              <button
                key={s.groupId}
                onClick={() => toggleGroup(s.groupId)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                  isActive
                    ? `${c.bg} ${c.text} ${c.border}`
                    : "border-[var(--border)] text-gray-600 bg-transparent opacity-50"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isActive ? c.dot : "bg-gray-600"}`} />
                {s.groupName}
                <span className="text-[10px] opacity-70">({s.pendingCount})</span>
              </button>
            );
          })}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Loading schedule...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && activeSchedules.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-10 text-center">
          <p className="text-sm text-gray-500">No scheduled uploads.</p>
          <p className="text-xs text-gray-600 mt-1">Add items to a group's queue to see them on the calendar.</p>
        </div>
      )}

      {!loading && !error && activeSchedules.length > 0 && (
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

                  {/* Schedule slots — only show blocks where a dispatch will actually happen */}
                  {(() => {
                    const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
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
                            href={`/groups/${s.groupId}/queue`}
                            className={`absolute left-1 right-1 z-10 rounded-md border px-1.5 py-0.5 text-[10px] leading-tight truncate hover:opacity-80 transition-opacity ${c.bg} ${c.border} ${c.text}`}
                            style={{ top: baseTop + idx * blockHeight, height: blockHeight }}
                            title={`${s.groupName} — ${formatTime12h(time)}${s.pendingCount > 0 ? ` (${s.pendingCount} queued)` : ""}`}
                          >
                            {s.groupName}
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
