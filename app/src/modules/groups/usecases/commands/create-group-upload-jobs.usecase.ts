import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/infrastructure/db";
import { accounts, groupDestinations, providers, destinations } from "@/infrastructure/db/schema";
import { createJob } from "@/infrastructure/jobs/job-service";
import { startJobRunner } from "@/infrastructure/jobs/job-runner";
import { getDestinationIconUrl } from "@/core/destination-icons";
import type { CreateUploadJobsDto } from "../../dtos/create-upload-jobs.dto";
import { assertAbsolutePath, downloadFromStorage } from "../shared/storage-helper";

type UploadJobMetadata = {
  title?: string;
  caption?: string;
  privacy?: string;
};

@Injectable()
export class CreateGroupUploadJobsUseCase {
  async execute(groupId: string, input: CreateUploadJobsDto, baseUrl: string) {
    assertAbsolutePath(input.absolutePath);

    // Download from 7router once; all destination jobs share the temp file
    const videoPath = await downloadFromStorage(input.absolutePath);
    return this.createJobsForFile(groupId, videoPath, input, baseUrl);
  }

  async executeFromLocalFile(groupId: string, videoPath: string, input: UploadJobMetadata, baseUrl: string) {
    return this.createJobsForFile(groupId, videoPath, input, baseUrl);
  }

  private async createJobsForFile(groupId: string, videoPath: string, input: UploadJobMetadata, baseUrl: string) {
    const db = getDb();
    const links = await db
      .select({ destinationId: groupDestinations.destinationId })
      .from(groupDestinations)
      .where(eq(groupDestinations.groupId, groupId))
      ;

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
      const dest = await db.select().from(destinations).where(eq(destinations.id, destinationId)).then((r) => r[0]);
      if (!dest) continue;
      const account = await db.select().from(accounts).where(eq(accounts.id, dest.socialAccountId)).then((r) => r[0]);
      if (!account) continue;
      const provider = await db.select().from(providers).where(eq(providers.id, account.providerId)).then((r) => r[0]);
      if (!provider) continue;

      const job = await createJob({
        accountId: account.id,
        destinationId,
        videoPath,
        title: input.title,
        caption: input.caption,
        privacy: input.privacy as "private" | "public" | "unlisted" | undefined,
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
    return { groupId, uploadBatchId, jobs };
  }
}
