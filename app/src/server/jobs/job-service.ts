import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { accounts, postJobs, providers } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { PublishStatus, ContentType } from "@/lib/enums";
import fs from "fs";
import { appendLog, emitStatus } from "./log-service";

export const CreateJobSchema = z.object({
  accountId: z.string(),
  destinationId: z.string().optional(),
  videoPath: z.string(),
  title: z.string().optional(),
  caption: z.string().optional(),
  privacy: z.enum(["private", "public", "unlisted"]).optional(),
  scheduledAt: z.string().optional(),
  /** Video (default) or Reel. Reel is currently only meaningful for Meta/Facebook Page. */
  contentType: z.enum(["Video", "Reel"]).optional(),
  groupId: z.string().optional(),
  uploadBatchId: z.string().optional(),
  /** Idempotency key — if a job with this key already exists, it is returned instead of inserting a duplicate. */
  idempotencyKey: z.string().optional(),
  /** Max retry attempts before giving up. Default = 6 (≈ 5min cap). */
  maxAttempts: z.number().int().positive().optional(),
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;

export async function createJob(input: CreateJobInput) {
  const db = getDb();
  const now = new Date().toISOString();

  // Idempotency: short-circuit if a job with this key already exists.
  if (input.idempotencyKey) {
    const existing = await db
      .select()
      .from(postJobs)
      .where(eq(postJobs.idempotencyKey, input.idempotencyKey))
      .then((r) => r[0]);
    if (existing) return { id: existing.id, status: existing.status };
  }

  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.accountId))
    .then((r) => r[0]);

  if (!account) throw new Error(`Account ${input.accountId} not found`);

  const provider = await db
    .select()
    .from(providers)
    .where(eq(providers.id, account.providerId))
    .then((r) => r[0]);

  if (!provider) throw new Error(`Provider for account not found`);

  // Best-effort: capture file size for progress reporting. Don't fail job creation if stat fails.
  let totalBytes: string | null = null;
  try {
    totalBytes = String(fs.statSync(input.videoPath).size);
  } catch {
    /* file may not be at this path yet — runner will surface the real error */
  }

  const id = `job_${nanoid(10)}`;

  await db.insert(postJobs).values({
    id,
    accountId: input.accountId,
    destinationId: input.destinationId ?? null,
    platform: provider.type,
    contentType: input.contentType ?? ContentType.Video,
    status: PublishStatus.Created,
    groupId: input.groupId ?? null,
    uploadBatchId: input.uploadBatchId ?? null,
    videoPath: input.videoPath,
    title: input.title ?? null,
    caption: input.caption ?? null,
    privacy: input.privacy ?? null,
    scheduledAt: input.scheduledAt ?? null,
    providerPostId: null,
    providerPostUrl: null,
    uploadSessionId: null,
    uploadSessionUrl: null,
    uploadUrl: null,
    startOffset: null,
    endOffset: null,
    uploadedBytes: "0",
    totalBytes,
    attemptCount: "0",
    maxAttempts: String(input.maxAttempts ?? 6),
    nextAttemptAt: null,
    lastStatusCheckedAt: null,
    errorMessage: null,
    lastErrorCode: null,
    lastErrorSubcode: null,
    lastNetworkError: null,
    lastTraceId: null,
    reconnectRequiredReason: null,
    idempotencyKey: input.idempotencyKey ?? null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return { id, status: PublishStatus.Created };
}

export async function getJob(id: string) {
  const db = getDb();
  return db.select().from(postJobs).where(eq(postJobs.id, id)).then((r) => r[0]);
}

export async function listJobs() {
  const db = getDb();
  return db.select().from(postJobs).orderBy(desc(postJobs.createdAt));
}

export async function updateJobStatus(
  id: string,
  status: string,
  extra?: {
    providerPostId?: string;
    providerPostUrl?: string;
    errorMessage?: string;
  }
) {
  const db = getDb();
  const current = await getJob(id);
  if (current?.status === PublishStatus.Cancelled && status !== PublishStatus.Cancelled) {
    return;
  }

  await db
    .update(postJobs)
    .set({
      status,
      providerPostId: extra?.providerPostId,
      providerPostUrl: extra?.providerPostUrl,
      errorMessage: extra?.errorMessage,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(postJobs.id, id));
}

export async function requeueJob(id: string) {
  const db = getDb();
  const job = await getJob(id);
  if (!job) throw new Error(`Job ${id} not found`);
  if (job.status === PublishStatus.Published) throw new Error("Published jobs cannot be retried");

  const active = [
    PublishStatus.Created,
    PublishStatus.Initializing,
    PublishStatus.Uploading,
    PublishStatus.Finishing,
    PublishStatus.Processing,
    PublishStatus.Retrying,
  ] as string[];
  if (active.includes(job.status)) throw new Error(`Cannot retry an active job with status ${job.status}`);

  // Reset retry bookkeeping so the runner picks it up immediately.
  await db
    .update(postJobs)
    .set({
      status: PublishStatus.Created,
      providerPostId: null,
      providerPostUrl: null,
      publishedAt: null,
      uploadSessionId: null,
      uploadSessionUrl: null,
      uploadUrl: null,
      startOffset: null,
      endOffset: null,
      uploadedBytes: "0",
      errorMessage: null,
      lastErrorCode: null,
      lastErrorSubcode: null,
      lastNetworkError: null,
      reconnectRequiredReason: null,
      attemptCount: "0",
      nextAttemptAt: null,
      lastStatusCheckedAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(postJobs.id, id));

  await appendLog(id, "info", `Job re-queued from ${job.status}`);
  emitStatus(id, PublishStatus.Created);

  return job;
}

export async function cancelJob(id: string) {
  const db = getDb();
  const job = await getJob(id);
  if (!job) throw new Error(`Job ${id} not found`);

  const terminal = [PublishStatus.Published, PublishStatus.Failed, PublishStatus.Cancelled] as string[];
  if (terminal.includes(job.status)) {
    throw new Error(`Cannot cancel a job with status ${job.status}`);
  }

  await db
    .update(postJobs)
    .set({
      status: PublishStatus.Cancelled,
      errorMessage: null,
      nextAttemptAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(postJobs.id, id));

  await appendLog(id, "warn", "Job cancelled by user");
  emitStatus(id, PublishStatus.Cancelled);

  return { id, status: PublishStatus.Cancelled };
}

export async function deleteJob(id: string) {
  const db = getDb();
  await db.delete(postJobs).where(eq(postJobs.id, id));
}
