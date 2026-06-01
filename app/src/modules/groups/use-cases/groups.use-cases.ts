import { Injectable } from "@nestjs/common";
import { existsSync } from "fs";
import { desc, eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import {
  accounts,
  groupDestinations,
  groups,
  postJobs,
  providers,
  publishDestinations,
} from "@/server/db/schema";
import { createJob } from "@/server/jobs/job-service";
import { startJobRunner } from "@/server/jobs/job-runner";
import { getDestinationIconUrl } from "@/lib/destination-icons";

function toSnakeCaseId(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

@Injectable()
export class GroupsUseCases {
  async list() {
    const db = getDb();
    const allGroups = await db.select().from(groups).orderBy(desc(groups.createdAt)).all();
    const allLinks = await db
      .select({
        groupId: groupDestinations.groupId,
        destinationId: publishDestinations.id,
        name: publishDestinations.name,
        type: publishDestinations.type,
        externalId: publishDestinations.externalId,
        socialAccountId: publishDestinations.socialAccountId,
        avatarUrl: publishDestinations.avatarUrl,
        providerType: providers.type,
        providerName: providers.name,
        accountAvatarUrl: accounts.avatarUrl,
      })
      .from(groupDestinations)
      .leftJoin(publishDestinations, eq(groupDestinations.destinationId, publishDestinations.id))
      .leftJoin(accounts, eq(publishDestinations.socialAccountId, accounts.id))
      .leftJoin(providers, eq(accounts.providerId, providers.id))
      .all();

    const destsByGroup = new Map<string, typeof allLinks>();
    for (const link of allLinks) {
      if (!destsByGroup.has(link.groupId)) destsByGroup.set(link.groupId, []);
      destsByGroup.get(link.groupId)!.push(link);
    }

    return allGroups.map((group) => ({
      ...group,
      destinations: destsByGroup.get(group.id) ?? [],
    }));
  }

  async create(input: { name?: string }) {
    if (!input.name?.trim()) throw new Error("Name is required");

    const id = toSnakeCaseId(input.name);
    if (!id) throw new Error("Name must contain letters or numbers");

    const db = getDb();
    const existing = await db.select().from(groups).where(eq(groups.id, id)).get();
    if (existing) {
      const err = new Error(`A group with id "${id}" already exists. Choose a different name.`);
      (err as Error & { status?: number }).status = 409;
      throw err;
    }

    const now = new Date().toISOString();
    await db.insert(groups).values({ id, name: input.name.trim(), createdAt: now });
    const row = await db.select().from(groups).where(eq(groups.id, id)).get();
    return { ...row, destinations: [] };
  }

  async rename(id: string, input: { name?: string }) {
    if (!input.name?.trim()) throw new Error("Name is required");

    const db = getDb();
    const row = await db.select().from(groups).where(eq(groups.id, id)).get();
    if (!row) return null;

    await db.update(groups).set({ name: input.name.trim() }).where(eq(groups.id, id));
    return db.select().from(groups).where(eq(groups.id, id)).get();
  }

  async remove(id: string) {
    const db = getDb();
    await db.delete(groupDestinations).where(eq(groupDestinations.groupId, id));
    await db.delete(groups).where(eq(groups.id, id));
  }

  async addDestination(groupId: string, destinationId: string | undefined) {
    if (!destinationId) throw new Error("destinationId is required");

    const db = getDb();
    const group = await db.select().from(groups).where(eq(groups.id, groupId)).get();
    if (!group) {
      const err = new Error("Group not found");
      (err as Error & { status?: number }).status = 404;
      throw err;
    }

    const dest = await db.select().from(publishDestinations).where(eq(publishDestinations.id, destinationId)).get();
    if (!dest) {
      const err = new Error("Destination not found");
      (err as Error & { status?: number }).status = 404;
      throw err;
    }

    const existing = await db
      .select()
      .from(groupDestinations)
      .where(and(eq(groupDestinations.groupId, groupId), eq(groupDestinations.destinationId, destinationId)))
      .get();
    if (existing) {
      const err = new Error("Already in group");
      (err as Error & { status?: number }).status = 409;
      throw err;
    }

    const id = `gdest_${nanoid(8)}`;
    await db.insert(groupDestinations).values({ id, groupId, destinationId, createdAt: new Date().toISOString() });
    return { id, groupId, destinationId };
  }

  async removeDestination(groupId: string, destinationId: string) {
    await getDb()
      .delete(groupDestinations)
      .where(and(eq(groupDestinations.groupId, groupId), eq(groupDestinations.destinationId, destinationId)));
  }

  async createUploadJobs(
    groupId: string,
    input: {
      videoPath?: string;
      title?: string;
      caption?: string;
      privacy?: string;
      scheduledAt?: string;
    },
    baseUrl: string,
  ) {
    if (!input.videoPath) throw new Error("videoPath is required");
    if (!existsSync(input.videoPath)) throw new Error(`File not found: ${input.videoPath}`);

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
        videoPath: input.videoPath,
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

  async history(groupId: string, limit = 100, baseUrl: string) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 250) : 100;
    const rows = await getDb()
      .select({
        id: postJobs.id,
        uploadBatchId: postJobs.uploadBatchId,
        status: postJobs.status,
        title: postJobs.title,
        caption: postJobs.caption,
        privacy: postJobs.privacy,
        scheduledAt: postJobs.scheduledAt,
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
      .all();

    const batches = new Map<
      string,
      {
        id: string;
        title: string | null;
        caption: string | null;
        privacy: string | null;
        scheduledAt: string | null;
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
          scheduledAt: row.scheduledAt,
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
        destinationIcon: row.destinationType
          ? getDestinationIconUrl(baseUrl, row.destinationType, row.providerType)
          : null,
      });
    }

    return {
      groupId,
      batches: [...batches.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }
}
