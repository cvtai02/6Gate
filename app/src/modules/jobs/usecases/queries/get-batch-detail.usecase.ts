import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, destinations, groups, postJobs, providers } from "@/infrastructure/db/schema";

@Injectable()
export class GetBatchDetailUseCase {
  async execute(batchId: string) {
    const db = getDb();

    const jobs = await db
      .select({
        id: postJobs.id,
        platform: postJobs.platform,
        status: postJobs.status,
        title: postJobs.title,
        caption: postJobs.caption,
        videoPath: postJobs.videoPath,
        privacy: postJobs.privacy,
        providerPostId: postJobs.providerPostId,
        providerPostUrl: postJobs.providerPostUrl,
        errorMessage: postJobs.errorMessage,
        scheduledAt: postJobs.scheduledAt,
        createdAt: postJobs.createdAt,
        updatedAt: postJobs.updatedAt,
        publishedAt: postJobs.publishedAt,
        uploadBatchId: postJobs.uploadBatchId,
        groupId: postJobs.groupId,
        groupName: groups.name,
        destinationName: destinations.name,
        destinationType: destinations.type,
        destinationAvatar: destinations.avatarUrl,
        accountName: accounts.displayName,
        accountAvatar: accounts.avatarUrl,
        providerType: providers.type,
      })
      .from(postJobs)
      .leftJoin(destinations, eq(postJobs.destinationId, destinations.id))
      .leftJoin(accounts, eq(postJobs.accountId, accounts.id))
      .leftJoin(providers, eq(accounts.providerId, providers.id))
      .leftJoin(groups, eq(postJobs.groupId, groups.id))
      .where(eq(postJobs.uploadBatchId, batchId));

    if (jobs.length === 0) return null;

    const first = jobs[0];
    return {
      batchId,
      title: first.title,
      groupId: first.groupId,
      groupName: first.groupName,
      videoPath: first.videoPath,
      createdAt: first.createdAt,
      jobs,
    };
  }
}
