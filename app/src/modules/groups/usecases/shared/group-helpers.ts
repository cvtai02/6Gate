import { existsSync } from "fs";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { groupUploadSettings, groups } from "@/server/db/schema";
import type { GroupUploadSettingsDto } from "../../dtos/group-upload-queue.dto";

export const DEFAULT_UPLOAD_TIME_IN_DAY = "09:00";
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

export function assertUploadTimeInDay(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error("uploadTimeInDay must use HH:mm format");
  const [hour, minute] = value.split(":").map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error("uploadTimeInDay must be a valid local time");
  }
}

export function assertExistingVideoPath(videoPath: string | undefined) {
  if (!videoPath) throw new Error("videoPath is required");
  if (!existsSync(videoPath)) throw new Error(`File not found: ${videoPath}`);
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
  const group = await getDb().select().from(groups).where(eq(groups.id, groupId)).get();
  if (!group) {
    const err = new Error("Group not found");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  return group;
}

export async function ensureUploadSettings(groupId: string): Promise<GroupUploadSettingsDto> {
  const existing = await getDb()
    .select()
    .from(groupUploadSettings)
    .where(eq(groupUploadSettings.groupId, groupId))
    .get();
  if (existing) return existing;

  const now = new Date().toISOString();
  const row = {
    groupId,
    uploadTimeInDay: DEFAULT_UPLOAD_TIME_IN_DAY,
    lastTriggeredDate: null,
    createdAt: now,
    updatedAt: now,
  };
  await getDb().insert(groupUploadSettings).values(row);
  return row;
}

export function groupSettingClaimWhere(groupId: string, updatedAt: string) {
  return and(eq(groupUploadSettings.groupId, groupId), eq(groupUploadSettings.updatedAt, updatedAt));
}
