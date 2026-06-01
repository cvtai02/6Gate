import { Injectable, OnModuleInit } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { accounts, postJobs, providers, publishDestinations } from "@/server/db/schema";
import { cancelJob, createJob, deleteJob, getJob, listJobs, requeueJob } from "@/server/jobs/job-service";
import { getJobLogs } from "@/server/jobs/log-service";
import { startJobRunner } from "@/server/jobs/job-runner";

@Injectable()
export class JobsUseCases implements OnModuleInit {
  onModuleInit() {
    startJobRunner();
  }

  create(input: unknown) {
    return createJob(input as any);
  }

  listRaw() {
    return listJobs();
  }

  listForTable() {
    return getDb()
      .select({
        id: postJobs.id,
        platform: postJobs.platform,
        status: postJobs.status,
        title: postJobs.title,
        caption: postJobs.caption,
        providerPostUrl: postJobs.providerPostUrl,
        scheduledAt: postJobs.scheduledAt,
        updatedAt: postJobs.updatedAt,
        destinationName: publishDestinations.name,
        destinationType: publishDestinations.type,
        destinationAvatar: publishDestinations.avatarUrl,
        accountAvatar: accounts.avatarUrl,
      })
      .from(postJobs)
      .leftJoin(publishDestinations, eq(postJobs.destinationId, publishDestinations.id))
      .leftJoin(accounts, eq(postJobs.accountId, accounts.id))
      .orderBy(desc(postJobs.updatedAt))
      .all();
  }

  async get(id: string) {
    const [job, logs] = await Promise.all([getJob(id), getJobLogs(id)]);
    if (!job) return null;

    const [account, destination] = await Promise.all([
      getDb().select().from(accounts).where(eq(accounts.id, job.accountId)).get(),
      job.destinationId
        ? getDb().select().from(publishDestinations).where(eq(publishDestinations.id, job.destinationId)).get()
        : Promise.resolve(null),
    ]);
    const provider = account
      ? await getDb().select().from(providers).where(eq(providers.id, account.providerId)).get()
      : null;

    return { ...job, account, destination, provider, logs };
  }

  remove(id: string) {
    return deleteJob(id);
  }

  cancel(id: string) {
    return cancelJob(id);
  }

  retry(id: string) {
    startJobRunner();
    return requeueJob(id);
  }
}
