import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, groupDestinations, jobLogs, postJobs, destinations } from "@/infrastructure/db/schema";
import { getAccountOrThrow } from "../shared/account-helpers";

@Injectable()
export class DeleteAccountUseCase {
  async execute(id: string) {
    const db = getDb();
    await getAccountOrThrow(id);
    const jobs = await db.select({ id: postJobs.id }).from(postJobs).where(eq(postJobs.accountId, id));
    for (const job of jobs) await db.delete(jobLogs).where(eq(jobLogs.jobId, job.id));
    await db.delete(postJobs).where(eq(postJobs.accountId, id));
    const dests = await db.select({ id: destinations.id }).from(destinations).where(eq(destinations.socialAccountId, id));
    for (const dest of dests) await db.delete(groupDestinations).where(eq(groupDestinations.destinationId, dest.id));
    await db.delete(destinations).where(eq(destinations.socialAccountId, id));
    await db.delete(accounts).where(eq(accounts.id, id));
  }
}
