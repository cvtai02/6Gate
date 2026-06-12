import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, providers, destinations } from "@/infrastructure/db/schema";
import { getJob } from "@/infrastructure/jobs/job-service";
import { getJobLogs } from "@/infrastructure/jobs/log-service";

@Injectable()
export class GetJobDetailUseCase {
  async execute(id: string) {
    const [job, logs] = await Promise.all([getJob(id), getJobLogs(id)]);
    if (!job) return null;

    const [account, destination] = await Promise.all([
      getDb().select().from(accounts).where(eq(accounts.id, job.accountId)).then((r) => r[0]),
      job.destinationId
        ? getDb().select().from(destinations).where(eq(destinations.id, job.destinationId)).then((r) => r[0])
        : Promise.resolve(null),
    ]);
    const provider = account
      ? await getDb().select().from(providers).where(eq(providers.id, account.providerId)).then((r) => r[0])
      : null;

    return { ...job, account, destination, provider, logs };
  }
}
