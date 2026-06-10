import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { accounts, groupDestinations, jobLogs, postJobs, providers, destinations } from "@/server/db/schema";
import { getProviderOrThrow } from "../shared/provider-helpers";

@Injectable()
export class DeleteProviderUseCase {
  async execute(id: string) {
    const db = getDb();
    await getProviderOrThrow(id);
    const providerAccounts = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.providerId, id));
    for (const acc of providerAccounts) {
      const jobs = await db.select({ id: postJobs.id }).from(postJobs).where(eq(postJobs.accountId, acc.id));
      for (const job of jobs) await db.delete(jobLogs).where(eq(jobLogs.jobId, job.id));
      const dests = await db.select({ id: destinations.id }).from(destinations).where(eq(destinations.socialAccountId, acc.id));
      for (const dest of dests) await db.delete(groupDestinations).where(eq(groupDestinations.destinationId, dest.id));
      await db.delete(destinations).where(eq(destinations.socialAccountId, acc.id));
      await db.delete(postJobs).where(eq(postJobs.accountId, acc.id));
    }
    await db.delete(accounts).where(eq(accounts.providerId, id));
    await db.delete(providers).where(eq(providers.id, id));
  }
}
