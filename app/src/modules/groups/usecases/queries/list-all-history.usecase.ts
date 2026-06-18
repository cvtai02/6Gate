import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, groups, postJobs, providers, destinations } from "@/infrastructure/db/schema";
import { getDestinationIconUrl } from "@/core/destination-icons";

@Injectable()
export class ListAllHistoryUseCase {
  async execute(limit = 250, baseUrl: string) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 250;
    const rows = await getDb()
      .select({
        id: postJobs.id,
        uploadBatchId: postJobs.uploadBatchId,
        groupId: postJobs.groupId,
        status: postJobs.status,
        title: postJobs.title,
        caption: postJobs.caption,
        videoPath: postJobs.videoPath,
        providerPostUrl: postJobs.providerPostUrl,
        errorMessage: postJobs.errorMessage,
        createdAt: postJobs.createdAt,
        updatedAt: postJobs.updatedAt,
        groupName: groups.name,
        destinationName: destinations.name,
        destinationType: destinations.type,
        destinationAvatar: destinations.avatarUrl,
        accountAvatar: accounts.avatarUrl,
        providerType: providers.type,
      })
      .from(postJobs)
      .leftJoin(groups, eq(postJobs.groupId, groups.id))
      .leftJoin(destinations, eq(postJobs.destinationId, destinations.id))
      .leftJoin(accounts, eq(postJobs.accountId, accounts.id))
      .leftJoin(providers, eq(accounts.providerId, providers.id))
      .orderBy(desc(postJobs.createdAt))
      .limit(safeLimit);

    const batches = new Map<string, {
      id: string;
      groupId: string | null;
      groupName: string | null;
      title: string | null;
      videoPath: string | null;
      createdAt: string;
      updatedAt: string;
      jobs: unknown[];
    }>();

    for (const row of rows) {
      const batchId = row.uploadBatchId ?? row.id;
      const existing = batches.get(batchId);
      if (!existing) {
        batches.set(batchId, {
          id: batchId,
          groupId: row.groupId,
          groupName: row.groupName,
          title: row.title,
          videoPath: row.videoPath,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          jobs: [],
        });
      } else {
        if (row.updatedAt > existing.updatedAt) existing.updatedAt = row.updatedAt;
        if (row.createdAt < existing.createdAt) existing.createdAt = row.createdAt;
      }

      batches.get(batchId)!.jobs.push({
        id: row.id,
        status: row.status,
        providerPostUrl: row.providerPostUrl,
        errorMessage: row.errorMessage,
        updatedAt: row.updatedAt,
        destinationName: row.destinationName,
        destinationType: row.destinationType,
        destinationAvatar: row.destinationAvatar,
        accountAvatar: row.accountAvatar,
        providerType: row.providerType,
        destinationIcon: row.destinationType ? getDestinationIconUrl(baseUrl, row.destinationType, row.providerType) : null,
      });
    }

    return {
      batches: [...batches.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }
}
