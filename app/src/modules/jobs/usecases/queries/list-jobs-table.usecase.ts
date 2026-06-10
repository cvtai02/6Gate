import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { accounts, postJobs, publishDestinations } from "@/server/db/schema";

@Injectable()
export class ListJobsTableUseCase {
  execute() {
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
      ;
  }
}
