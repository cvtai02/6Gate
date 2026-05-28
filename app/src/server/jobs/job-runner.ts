import { getDb } from "@/server/db";
import { accounts, postJobs, providers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getAdapter } from "@/server/providers/registry";
import { appendLog, emitStatus } from "./log-service";
import { updateJobStatus } from "./job-service";
import fs from "fs";

let running = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function processNextJob() {
  if (running) return;

  const db = getDb();
  const job = await db
    .select()
    .from(postJobs)
    .where(eq(postJobs.status, "queued"))
    .get();

  if (!job) return;

  running = true;

  try {
    await updateJobStatus(job.id, "running");
    emitStatus(job.id, "running");
    await appendLog(job.id, "info", "Job picked up by runner");

    const account = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, job.accountId))
      .get();

    if (!account) throw new Error(`Account ${job.accountId} not found`);

    const provider = await db
      .select()
      .from(providers)
      .where(eq(providers.id, account.providerId))
      .get();

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
    });

    await appendLog(job.id, "info", "Publish completed");

    await updateJobStatus(job.id, "completed", {
      providerPostId: result.providerPostId,
      providerPostUrl: result.url,
    });
    emitStatus(job.id, "completed", {
      providerPostId: result.providerPostId,
      providerPostUrl: result.url,
    });
    await appendLog(job.id, "info", "Job completed successfully");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await appendLog(job.id, "error", `Job failed: ${message}`);
    await updateJobStatus(job.id, "failed", { errorMessage: message });
    emitStatus(job.id, "failed", { errorMessage: message });
  } finally {
    running = false;
  }
}

async function resetOrphanedJobs() {
  const db = getDb();
  const orphans = await db
    .select()
    .from(postJobs)
    .where(eq(postJobs.status, "running"))
    .all();

  for (const job of orphans) {
    // If the temp video file is gone, mark failed — nothing to retry.
    if (!fs.existsSync(job.videoPath)) {
      await appendLog(job.id, "error", "Job interrupted by server restart; video file no longer exists");
      await updateJobStatus(job.id, "failed", { errorMessage: "Interrupted by server restart — video file is gone" });
      emitStatus(job.id, "failed", { errorMessage: "Interrupted by server restart — video file is gone" });
    } else {
      await appendLog(job.id, "info", "Job re-queued after server restart");
      await updateJobStatus(job.id, "queued");
    }
  }
}

export function startJobRunner() {
  if (intervalId) return;
  resetOrphanedJobs();
  intervalId = setInterval(processNextJob, 2000);
  processNextJob();
}

export function stopJobRunner() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
