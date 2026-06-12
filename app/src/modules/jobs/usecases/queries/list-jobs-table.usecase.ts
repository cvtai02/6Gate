import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, postJobs, destinations } from "@/infrastructure/db/schema";

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
        destinationName: destinations.name,
        destinationType: destinations.type,
        destinationAvatar: destinations.avatarUrl,
        accountAvatar: accounts.avatarUrl,
      })
      .from(postJobs)
      .leftJoin(destinations, eq(postJobs.destinationId, destinations.id))
      .leftJoin(accounts, eq(postJobs.accountId, accounts.id))
      .orderBy(desc(postJobs.updatedAt))
      ;
  }
}
