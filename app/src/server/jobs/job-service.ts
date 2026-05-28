import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { accounts, postJobs, providers } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export const CreateJobSchema = z.object({
  accountId: z.string(),
  destinationId: z.string().optional(),
  videoPath: z.string(),
  title: z.string().optional(),
  caption: z.string().optional(),
  privacy: z.enum(["private", "public", "unlisted"]).optional(),
  scheduledAt: z.string().optional(),
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;

export async function createJob(input: CreateJobInput) {
  const db = getDb();
  const now = new Date().toISOString();

  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.accountId))
    .get();

  if (!account) throw new Error(`Account ${input.accountId} not found`);

  const provider = await db
    .select()
    .from(providers)
    .where(eq(providers.id, account.providerId))
    .get();

  if (!provider) throw new Error(`Provider for account not found`);

  const id = `job_${nanoid(10)}`;

  await db.insert(postJobs).values({
    id,
    accountId: input.accountId,
    destinationId: input.destinationId ?? null,
    platform: provider.type,
    status: "queued",
    videoPath: input.videoPath,
    title: input.title ?? null,
    caption: input.caption ?? null,
    privacy: input.privacy ?? null,
    scheduledAt: input.scheduledAt ?? null,
    providerPostId: null,
    providerPostUrl: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  });

  return { id, status: "queued" };
}

export async function getJob(id: string) {
  const db = getDb();
  return db.select().from(postJobs).where(eq(postJobs.id, id)).get();
}

export async function listJobs() {
  const db = getDb();
  return db.select().from(postJobs).orderBy(desc(postJobs.createdAt)).all();
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
  if (job.status !== "failed") throw new Error("Only failed jobs can be retried");

  await db
    .update(postJobs)
    .set({ status: "queued", errorMessage: null, updatedAt: new Date().toISOString() })
    .where(eq(postJobs.id, id));

  return job;
}

export async function deleteJob(id: string) {
  const db = getDb();
  await db.delete(postJobs).where(eq(postJobs.id, id));
}
