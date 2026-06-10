import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { accounts, providers, publishDestinations } from "@/server/db/schema";
import { getJob } from "@/server/jobs/job-service";
import { getJobLogs } from "@/server/jobs/log-service";

@Injectable()
export class GetJobDetailUseCase {
  async execute(id: string) {
    const [job, logs] = await Promise.all([getJob(id), getJobLogs(id)]);
    if (!job) return null;

    const [account, destination] = await Promise.all([
      getDb().select().from(accounts).where(eq(accounts.id, job.accountId)).then((r) => r[0]),
      job.destinationId
        ? getDb().select().from(publishDestinations).where(eq(publishDestinations.id, job.destinationId)).then((r) => r[0])
        : Promise.resolve(null),
    ]);
    const provider = account
      ? await getDb().select().from(providers).where(eq(providers.id, account.providerId)).then((r) => r[0])
      : null;

    return { ...job, account, destination, provider, logs };
  }
}
