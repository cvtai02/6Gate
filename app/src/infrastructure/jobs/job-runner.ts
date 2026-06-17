import { getDb } from "@/infrastructure/db";
import { accounts, groupUploadQueue, postJobs, providers } from "@/infrastructure/db/schema";
import { and, eq } from "drizzle-orm";
import { getAdapter } from "@/infrastructure/providers/registry";
import { appendLog, emitStatus } from "./log-service";
import { getJob, updateJobStatus } from "./job-service";
import { PublishStatus } from "@/core/enums";
import { notifyTelegramIfConfigured } from "@/infrastructure/providers/telegram-notify";
import fs from "fs";

// HOT-RELOAD SAFETY: pin state to globalThis so it survives module re-evaluations.
// Atomic claim via UPDATE ... WHERE status=Created ... RETURNING prevents double processing.
type RunnerState = { running: boolean; intervalId: ReturnType<typeof setInterval> | null };
const _global = globalThis as unknown as { __6gate_jobRunnerState?: RunnerState };
const state: RunnerState =
  _global.__6gate_jobRunnerState ?? (_global.__6gate_jobRunnerState = { running: false, intervalId: null });

async function waitForFile(filePath: string, maxWaitMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      fs.statSync(filePath);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

async function isCancelled(jobId: string) {
  const job = await getJob(jobId);
  return job?.status === PublishStatus.Cancelled;
}

async function processNextJob() {
  if (state.running) return;
  state.running = true;

  try {
    await processAllPendingJobs();
  } finally {
    state.running = false;
  }
}

// Claim all pending jobs before processing any, so a secondary process can't steal
// individual jobs between processing cycles.
async function processAllPendingJobs() {
  const db = getDb();

  let candidates: (typeof postJobs.$inferSelect)[];
  try {
    const all = await db
      .select()
      .from(postJobs)
      .where(eq(postJobs.status, PublishStatus.Created));
    const nowMs = Date.now();
    candidates = all.filter((job) => !job.scheduledAt || new Date(job.scheduledAt).getTime() <= nowMs);
  } catch {
    return;
  }

  if (candidates.length === 0) return;

  const now = new Date().toISOString();
  const claimed: (typeof postJobs.$inferSelect)[] = [];
  for (const c of candidates) {
    const row = await db
      .update(postJobs)
      .set({ status: PublishStatus.Uploading, updatedAt: now })
      .where(and(eq(postJobs.id, c.id), eq(postJobs.status, PublishStatus.Created)))
      .returning()
      .then((r) => r[0]);
    if (row) claimed.push(row);
  }

  for (const job of claimed) {
    try {
      emitStatus(job.id, PublishStatus.Uploading);
      await appendLog(job.id, "info", "Job picked up by runner");

      const account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, job.accountId))
        .then((r) => r[0]);

      if (!account) throw new Error(`Account ${job.accountId} not found`);

      const provider = await db
        .select()
        .from(providers)
        .where(eq(providers.id, account.providerId))
        .then((r) => r[0]);

      if (!provider) throw new Error(`Provider not found`);

      const adapter = getAdapter(provider.type);

      await appendLog(job.id, "info", "Preparing video");
      await waitForFile(job.videoPath);
      try {
        fs.statSync(job.videoPath);
      } catch {
        await appendLog(job.id, "warn", `File not immediately visible, retrying...`);
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 500));
          try { fs.statSync(job.videoPath); break; } catch { /* keep trying */ }
        }
      }
      await appendLog(job.id, "info", `Uploading video: ${job.videoPath}`);

      const result = await adapter.publishVideo({
        accountId: job.accountId,
        destinationId: job.destinationId ?? undefined,
        videoPath: job.videoPath,
        title: job.title ?? undefined,
        caption: job.caption ?? undefined,
        privacy: (job.privacy as "private" | "public" | "unlisted") ?? undefined,
        scheduledAt: job.scheduledAt ?? undefined,
        jobId: job.id,
        contentType: (job.contentType as "Video" | "Reel") ?? undefined,
      });

      if (await isCancelled(job.id)) {
        await appendLog(job.id, "warn", "Publish finished after cancellation; keeping job cancelled");
        emitStatus(job.id, PublishStatus.Cancelled);
        continue;
      }

      await appendLog(job.id, "info", "Publish completed");

      await updateJobStatus(job.id, PublishStatus.Published, {
        providerPostId: result.providerPostId,
        providerPostUrl: result.url,
      });
      emitStatus(job.id, PublishStatus.Published, {
        providerPostId: result.providerPostId,
        providerPostUrl: result.url,
      });
      await appendLog(job.id, "info", "Job completed successfully");

      if (job.uploadBatchId) {
        const batchJobs = await db.select().from(postJobs).where(eq(postJobs.uploadBatchId, job.uploadBatchId));
        if (batchJobs.length > 0 && batchJobs.every((j) => j.status === PublishStatus.Published)) {
          await db.delete(groupUploadQueue).where(eq(groupUploadQueue.uploadBatchId, job.uploadBatchId));
        }
        await notifyTelegramIfConfigured(job.uploadBatchId).catch(() => {});
      }
    } catch (err) {
      if (await isCancelled(job.id)) {
        await appendLog(job.id, "warn", "Upload stopped after cancellation");
        emitStatus(job.id, PublishStatus.Cancelled);
        continue;
      }

      const message = err instanceof Error ? err.message : String(err);
      await appendLog(job.id, "error", `Job failed: ${message}`);
      await updateJobStatus(job.id, PublishStatus.Failed, { errorMessage: message });
      emitStatus(job.id, PublishStatus.Failed, { errorMessage: message });
      if (job.uploadBatchId) {
        await notifyTelegramIfConfigured(job.uploadBatchId).catch(() => {});
      }
    }
  }
}

async function resetOrphanedJobs() {
  const db = getDb();
  const ACTIVE = [
    PublishStatus.Initializing,
    PublishStatus.Uploading,
    PublishStatus.Finishing,
    PublishStatus.Processing,
    PublishStatus.Retrying,
  ];
  const orphans = (
    await db.select().from(postJobs)
  ).filter((j) => (ACTIVE as string[]).includes(j.status));

  for (const job of orphans) {
    if (!fs.existsSync(job.videoPath)) {
      await appendLog(job.id, "error", "Job interrupted by server restart; video file no longer exists");
      await updateJobStatus(job.id, PublishStatus.Failed, { errorMessage: "Interrupted by server restart — video file is gone" });
      emitStatus(job.id, PublishStatus.Failed, { errorMessage: "Interrupted by server restart — video file is gone" });
    } else {
      await appendLog(job.id, "info", "Job re-queued after server restart");
      await updateJobStatus(job.id, PublishStatus.Created);
    }
  }
}

export function startJobRunner() {
  if (state.intervalId) {
    processNextJob();
    return;
  }
  resetOrphanedJobs();
  state.intervalId = setInterval(processNextJob, 2000);
  processNextJob();
}

export function stopJobRunner() {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}
