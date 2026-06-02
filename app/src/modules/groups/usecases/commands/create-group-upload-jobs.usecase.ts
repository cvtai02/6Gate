import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { accounts, groupDestinations, providers, publishDestinations } from "@/server/db/schema";
import { createJob } from "@/server/jobs/job-service";
import { startJobRunner } from "@/server/jobs/job-runner";
import { getDestinationIconUrl } from "@/lib/destination-icons";
import type { CreateUploadJobsDto } from "../../dtos/create-upload-jobs.dto";
import { assertExistingVideoPath } from "../shared/group-helpers";

@Injectable()
export class CreateGroupUploadJobsUseCase {
  async execute(groupId: string, input: CreateUploadJobsDto, baseUrl: string) {
    assertExistingVideoPath(input.videoPath);

    const db = getDb();
    const links = await db
      .select({ destinationId: groupDestinations.destinationId })
      .from(groupDestinations)
      .where(eq(groupDestinations.groupId, groupId))
      .all();

    if (links.length === 0) throw new Error("Group has no destinations");

    const uploadBatchId = `batch_${nanoid(10)}`;
    const jobs: {
      id: string;
      destinationId: string;
      destinationName: string;
      destinationIcon: string | null;
      platform: string;
      jobDetailsLink: string;
      jobEventsLink: string;
      jobCancelLink: string;
    }[] = [];

    for (const { destinationId } of links) {
      const dest = await db.select().from(publishDestinations).where(eq(publishDestinations.id, destinationId)).get();
      if (!dest) continue;
      const account = await db.select().from(accounts).where(eq(accounts.id, dest.socialAccountId)).get();
      if (!account) continue;
      const provider = await db.select().from(providers).where(eq(providers.id, account.providerId)).get();
      if (!provider) continue;

      const job = await createJob({
        accountId: account.id,
        destinationId,
        videoPath: input.videoPath!,
        title: input.title,
        caption: input.caption,
        privacy: input.privacy as "private" | "public" | "unlisted" | undefined,
        scheduledAt: input.scheduledAt,
        groupId,
        uploadBatchId,
      });

      jobs.push({
        id: job.id,
        destinationId,
        destinationName: dest.name,
        destinationIcon: getDestinationIconUrl(baseUrl, dest.type, provider.type),
        platform: provider.type,
        jobDetailsLink: new URL(`/jobs/${job.id}`, baseUrl).toString(),
        jobEventsLink: new URL(`/api/post-jobs/${job.id}/events`, baseUrl).toString(),
        jobCancelLink: new URL(`/api/post-jobs/${job.id}/cancel`, baseUrl).toString(),
      });
    }

    startJobRunner();
    return { groupId, uploadBatchId, scheduledAt: input.scheduledAt ?? null, jobs };
  }
}
