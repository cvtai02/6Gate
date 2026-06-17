import { Injectable } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, destinations, groups, groupNotificationChannels, postJobs, providers } from "@/infrastructure/db/schema";

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
    const groupId = first.groupId;

    let notificationChannels: { id: string; chatId: string; chatName: string | null; botName: string | null }[] = [];
    if (groupId) {
      const channels = await db.select().from(groupNotificationChannels).where(eq(groupNotificationChannels.groupId, groupId));
      if (channels.length > 0) {
        const accountIds = [...new Set(channels.map((c) => c.accountId))];
        const accountRows = await db.select().from(accounts).where(inArray(accounts.id, accountIds));
        const accountMap = new Map(accountRows.map((a) => [a.id, a]));
        notificationChannels = channels.map((ch) => {
          const acc = accountMap.get(ch.accountId);
          return {
            id: ch.id,
            chatId: ch.chatId,
            chatName: ch.chatName,
            botName: acc?.displayName ?? acc?.username ?? null,
          };
        });
      }
    }

    return {
      batchId,
      title: first.title,
      groupId: first.groupId,
      groupName: first.groupName,
      videoPath: first.videoPath,
      createdAt: first.createdAt,
      jobs,
      notificationChannels,
    };
  }
}
