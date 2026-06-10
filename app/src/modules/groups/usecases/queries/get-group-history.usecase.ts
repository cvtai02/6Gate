import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { accounts, postJobs, providers, publishDestinations } from "@/server/db/schema";
import { getDestinationIconUrl } from "@/lib/destination-icons";

@Injectable()
export class GetGroupHistoryUseCase {
  async execute(groupId: string, limit = 100, baseUrl: string) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 250) : 100;
    const rows = await getDb()
      .select({
        id: postJobs.id,
        uploadBatchId: postJobs.uploadBatchId,
        status: postJobs.status,
        title: postJobs.title,
        caption: postJobs.caption,
        privacy: postJobs.privacy,
        videoPath: postJobs.videoPath,
        providerPostUrl: postJobs.providerPostUrl,
        errorMessage: postJobs.errorMessage,
        createdAt: postJobs.createdAt,
        updatedAt: postJobs.updatedAt,
        destinationId: publishDestinations.id,
        destinationName: publishDestinations.name,
        destinationType: publishDestinations.type,
        destinationAvatar: publishDestinations.avatarUrl,
        accountAvatar: accounts.avatarUrl,
        providerType: providers.type,
      })
      .from(postJobs)
      .leftJoin(publishDestinations, eq(postJobs.destinationId, publishDestinations.id))
      .leftJoin(accounts, eq(postJobs.accountId, accounts.id))
      .leftJoin(providers, eq(accounts.providerId, providers.id))
      .where(eq(postJobs.groupId, groupId))
      .orderBy(desc(postJobs.createdAt))
      .limit(safeLimit)
      ;

    const batches = new Map<
      string,
      {
        id: string;
        title: string | null;
        caption: string | null;
        privacy: string | null;
        videoPath: string | null;
        createdAt: string;
        updatedAt: string;
        jobs: unknown[];
      }
    >();

    for (const row of rows) {
      const batchId = row.uploadBatchId ?? row.id;
      const existing = batches.get(batchId);
      const updatedAt = existing && existing.updatedAt > row.updatedAt ? existing.updatedAt : row.updatedAt;
      if (!existing) {
        batches.set(batchId, {
          id: batchId,
          title: row.title,
          caption: row.caption,
          privacy: row.privacy,
          videoPath: row.videoPath,
          createdAt: row.createdAt,
          updatedAt,
          jobs: [],
        });
      } else {
        existing.updatedAt = updatedAt;
        if (row.createdAt < existing.createdAt) existing.createdAt = row.createdAt;
      }

      batches.get(batchId)!.jobs.push({
        id: row.id,
        status: row.status,
        providerPostUrl: row.providerPostUrl,
        errorMessage: row.errorMessage,
        updatedAt: row.updatedAt,
        destinationId: row.destinationId,
        destinationName: row.destinationName,
        destinationType: row.destinationType,
        destinationAvatar: row.destinationAvatar,
        accountAvatar: row.accountAvatar,
        providerType: row.providerType,
        destinationIcon: row.destinationType ? getDestinationIconUrl(baseUrl, row.destinationType, row.providerType) : null,
      });
    }

    return {
      groupId,
      batches: [...batches.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }
}
