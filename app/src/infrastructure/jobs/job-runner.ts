import { getDb } from "@/infrastructure/db";
import { accounts, groupUploadQueue, postJobs, providers } from "@/infrastructure/db/schema";
import { and, eq } from "drizzle-orm";
import { getAdapter } from "@/infrastructure/providers/registry";
import { appendLog, emitStatus } from "./log-service";
import { getJob, updateJobStatus } from "./job-service";
import { PublishStatus } from "@/core/enums";
import fs from "fs";

// NOTE: This runner is the legacy one-shot loop. The resilient-job rewrite (state machine
// + retry/backoff + stuck-job recovery) is still pending.
//
// HOT-RELOAD SAFETY: Next.js dev mode re-evaluates server modules on every change, which
// re-initializes module-scope state. The old module's setInterval keeps firing in the
// previous scope while a new module instance starts a fresh interval — result is two
// runners polling the queue and racing on the same job. We pin the state to `globalThis`
// so it survives reloads, and we atomically claim jobs via UPDATE ... RETURNING so even
// if two runners do race, only one wins the row.

type RunnerState = { running: boolean; intervalId: ReturnType<typeof setInterval> | null };
const _global = globalThis as unknown as { __6gate_jobRunnerState?: RunnerState };
const state: RunnerState =
  _global.__6gate_jobRunnerState ?? (_global.__6gate_jobRunnerState = { running: false, intervalId: null });

async function isCancelled(jobId: string) {
  const job = await getJob(jobId);
  return job?.status === PublishStatus.Cancelled;
}

async function processNextJob() {
  if (state.running) return;

  const db = getDb();
  const candidates = await db
    .select()
    .from(postJobs)
    .where(eq(postJobs.status, PublishStatus.Created))
    ;
  const nowMs = Date.now();
  const candidate = candidates.find((job) => !job.scheduledAt || new Date(job.scheduledAt).getTime() <= nowMs);

  if (!candidate) return;

  // Atomic claim: only the runner that flips Created→Uploading actually owns the job.
  // If another runner beat us to it, the WHERE clause won't match and `claimed` is empty.
  const now = new Date().toISOString();
  const claimed = await db
    .update(postJobs)
    .set({ status: PublishStatus.Uploading, updatedAt: now })
    .where(and(eq(postJobs.id, candidate.id), eq(postJobs.status, PublishStatus.Created)))
    .returning()
    .then((r) => r[0]);

  if (!claimed) return; // lost the race — another runner claimed it

  const job = claimed;
  state.running = true;

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
      return;
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

    // Once all jobs in a batch are Published, remove the queue item
    if (job.uploadBatchId) {
      const batchJobs = await db.select().from(postJobs).where(eq(postJobs.uploadBatchId, job.uploadBatchId));
      if (batchJobs.length > 0 && batchJobs.every((j) => j.status === PublishStatus.Published)) {
        await db.delete(groupUploadQueue).where(eq(groupUploadQueue.uploadBatchId, job.uploadBatchId));
      }
    }
  } catch (err) {
    if (await isCancelled(job.id)) {
      await appendLog(job.id, "warn", "Upload stopped after cancellation");
      emitStatus(job.id, PublishStatus.Cancelled);
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    await appendLog(job.id, "error", `Job failed: ${message}`);
    await updateJobStatus(job.id, PublishStatus.Failed, { errorMessage: message });
    emitStatus(job.id, PublishStatus.Failed, { errorMessage: message });
  } finally {
    state.running = false;
  }
}

async function resetOrphanedJobs() {
  const db = getDb();
  // Pick up jobs left in any active phase by a previous process.
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
  if (state.intervalId) return;
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
