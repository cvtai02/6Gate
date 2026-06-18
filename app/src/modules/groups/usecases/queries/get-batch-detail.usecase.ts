import { Injectable } from "@nestjs/common";
import { eq, or } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, groups, postJobs, providers, destinations, groupNotificationChannels } from "@/infrastructure/db/schema";
import { getDestinationIconUrl } from "@/core/destination-icons";

@Injectable()
export class GetBatchDetailUseCase {
  async execute(batchId: string, baseUrl: string) {
    const rows = await getDb()
      .select({
        id: postJobs.id,
        uploadBatchId: postJobs.uploadBatchId,
        groupId: postJobs.groupId,
        platform: postJobs.platform,
        status: postJobs.status,
        title: postJobs.title,
        caption: postJobs.caption,
        privacy: postJobs.privacy,
        videoPath: postJobs.videoPath,
        providerPostUrl: postJobs.providerPostUrl,
        errorMessage: postJobs.errorMessage,
        publishedAt: postJobs.publishedAt,
        scheduledAt: postJobs.scheduledAt,
        createdAt: postJobs.createdAt,
        updatedAt: postJobs.updatedAt,
        groupName: groups.name,
        destinationName: destinations.name,
        destinationType: destinations.type,
        destinationAvatar: destinations.avatarUrl,
        accountName: accounts.displayName,
        accountAvatar: accounts.avatarUrl,
        providerType: providers.type,
      })
      .from(postJobs)
      .leftJoin(groups, eq(postJobs.groupId, groups.id))
      .leftJoin(destinations, eq(postJobs.destinationId, destinations.id))
      .leftJoin(accounts, eq(postJobs.accountId, accounts.id))
      .leftJoin(providers, eq(accounts.providerId, providers.id))
      .where(or(eq(postJobs.uploadBatchId, batchId), eq(postJobs.id, batchId)));

    if (rows.length === 0) return null;

    const first = rows[0];
    const groupId = first.groupId;

    let notificationChannels: { id: string; chatId: string; chatName: string | null }[] = [];
    if (groupId) {
      notificationChannels = await getDb()
        .select({ id: groupNotificationChannels.id, chatId: groupNotificationChannels.chatId, chatName: groupNotificationChannels.chatName })
        .from(groupNotificationChannels)
        .where(eq(groupNotificationChannels.groupId, groupId));
    }

    return {
      batchId,
      groupId,
      groupName: first.groupName,
      title: first.title,
      videoPath: first.videoPath,
      createdAt: first.createdAt,
      jobs: rows.map((row) => ({
        id: row.id,
        platform: row.platform,
        status: row.status,
        title: row.title,
        providerPostUrl: row.providerPostUrl,
        errorMessage: row.errorMessage,
        publishedAt: row.publishedAt,
        scheduledAt: row.scheduledAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        destinationName: row.destinationName,
        destinationType: row.destinationType,
        destinationAvatar: row.destinationAvatar,
        accountName: row.accountName,
        accountAvatar: row.accountAvatar,
        providerType: row.providerType,
      })),
      notificationChannels,
    };
  }
}
