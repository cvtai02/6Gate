import { nanoid } from "nanoid";
import { getDb } from "@/infrastructure/db";
import { jobLogs } from "@/infrastructure/db/schema";
import { eq, desc } from "drizzle-orm";

export type LogLevel = "info" | "warn" | "error";

const subscribers = new Map<string, Set<(event: string) => void>>();

export function subscribeToJob(jobId: string, callback: (event: string) => void): () => void {
  if (!subscribers.has(jobId)) {
    subscribers.set(jobId, new Set());
  }
  subscribers.get(jobId)!.add(callback);

  return () => {
    subscribers.get(jobId)?.delete(callback);
    if (subscribers.get(jobId)?.size === 0) {
      subscribers.delete(jobId);
    }
  };
}

function emit(jobId: string, eventType: string, data: Record<string, unknown>) {
  const perJobMsg = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  subscribers.get(jobId)?.forEach((cb) => cb(perJobMsg));
}

export async function appendLog(jobId: string, level: LogLevel, message: string) {
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(jobLogs).values({
    id: nanoid(),
    jobId,
    level,
    message,
    createdAt: now,
  });
  emit(jobId, "log", { level, message, createdAt: now });
}

export function emitStatus(
  jobId: string,
  status: string,
  extra?: {
    providerPostId?: string | null;
    providerPostUrl?: string | null;
    errorMessage?: string | null;
  }
) {
  emit(jobId, "status", { status, ...(extra ?? {}) });
}

export async function getJobLogs(jobId: string) {
  const db = getDb();
  return db
    .select()
    .from(jobLogs)
    .where(eq(jobLogs.jobId, jobId))
    .orderBy(jobLogs.createdAt)
    ;
}
