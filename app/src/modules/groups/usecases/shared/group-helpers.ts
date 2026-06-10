import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { groupUploadSettings, groups } from "@/server/db/schema";
import type { GroupUploadSettingsDto } from "../../dtos/group-upload-queue.dto";

export const DEFAULT_UPLOAD_TIMES = "09:00";
export const QUEUE_STATUS_PENDING = "Pending";
export const QUEUE_STATUS_DISPATCHED = "Dispatched";
export const QUEUE_STATUS_FAILED = "Failed";
export const LOCAL_SCHEDULER_BASE_URL = "http://localhost:20130";

export function toSnakeCaseId(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function assertUploadTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error(`"${value}" must use HH:mm format`);
  const [hour, minute] = value.split(":").map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`"${value}" is not a valid local time`);
  }
}

export function assertUploadTimesInDay(times: string[]) {
  if (!times.length) throw new Error("At least one upload time is required");
  for (const t of times) assertUploadTime(t);
}

export function parseUploadTimes(raw: string): string[] {
  return raw.split(",").map((t) => t.trim()).filter(Boolean);
}

export function serializeUploadTimes(times: string[]): string {
  return times.join(",");
}

/** Format: "YYYY-MM-DD|HH:mm" — tracks last triggered slot. Old format "YYYY-MM-DD" (no pipe) is treated as conservative (all slots today already triggered). */
export function parseLastTriggeredSlot(value: string | null): { date: string; slot: string } | null {
  if (!value) return null;
  if (value.includes("|")) {
    const [date, slot] = value.split("|");
    return { date, slot };
  }
  // Old format — treat as "triggered today with no specific slot"
  return { date: value, slot: "23:59" };
}

export function makeLastTriggeredSlot(date: string, slot: string) {
  return `${date}|${slot}`;
}

export function localDateKey(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function localTimeKey(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export async function ensureGroup(groupId: string) {
  const group = await getDb().select().from(groups).where(eq(groups.id, groupId)).then((r) => r[0]);
  if (!group) {
    const err = new Error("Group not found");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  return group;
}

function toSettingsDto(raw: { groupId: string; uploadTimeInDay: string; lastTriggeredDate: string | null; createdAt: string; updatedAt: string }): GroupUploadSettingsDto {
  return {
    groupId: raw.groupId,
    uploadTimesInDay: parseUploadTimes(raw.uploadTimeInDay),
    lastTriggeredDate: raw.lastTriggeredDate,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function ensureUploadSettings(groupId: string): Promise<GroupUploadSettingsDto> {
  const existing = await getDb()
    .select()
    .from(groupUploadSettings)
    .where(eq(groupUploadSettings.groupId, groupId))
    .then((r) => r[0]);
  if (existing) return toSettingsDto(existing);

  const now = new Date().toISOString();
  const row = {
    groupId,
    uploadTimeInDay: DEFAULT_UPLOAD_TIMES,
    lastTriggeredDate: null,
    createdAt: now,
    updatedAt: now,
  };
  await getDb().insert(groupUploadSettings).values(row);
  return toSettingsDto(row);
}

export function groupSettingClaimWhere(groupId: string, updatedAt: string) {
  return and(eq(groupUploadSettings.groupId, groupId), eq(groupUploadSettings.updatedAt, updatedAt));
}
