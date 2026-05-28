import { getDb } from "@/server/db";
import { publishDestinations, groupDestinations, accounts, providers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getAdapter } from "./providers/registry";
import type { PublishVideoInput, PublishVideoResult } from "./providers/types";

export type VideoUploadInput = {
  videoPath: string;
  title?: string;
  caption?: string;
  privacy?: "private" | "public" | "unlisted";
};

export type DestinationUploadResult = {
  destinationId: string;
  destinationName: string;
  status: "success" | "error";
  providerPostId?: string;
  url?: string;
  error?: string;
};

export async function uploadVideoToDestination(
  destinationId: string,
  input: VideoUploadInput
): Promise<DestinationUploadResult> {
  const db = getDb();

  const dest = await db
    .select()
    .from(publishDestinations)
    .where(eq(publishDestinations.id, destinationId))
    .get();
  if (!dest) throw new Error(`Destination ${destinationId} not found`);

  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, dest.socialAccountId))
    .get();
  if (!account) throw new Error(`Account for destination ${destinationId} not found`);

  const provider = await db
    .select()
    .from(providers)
    .where(eq(providers.id, account.providerId))
    .get();
  if (!provider) throw new Error(`Provider for account ${account.id} not found`);

  const adapter = getAdapter(provider.type);

  const publishInput: PublishVideoInput = {
    accountId: account.id,
    destinationId,
    videoPath: input.videoPath,
    title: input.title,
    caption: input.caption,
    privacy: input.privacy,
  };

  try {
    const result: PublishVideoResult = await adapter.publishVideo(publishInput);
    return {
      destinationId,
      destinationName: dest.name,
      status: "success",
      providerPostId: result.providerPostId,
      url: result.url,
    };
  } catch (err) {
    return {
      destinationId,
      destinationName: dest.name,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function uploadVideoToDestinationGroup(
  groupId: string,
  input: VideoUploadInput
): Promise<DestinationUploadResult[]> {
  const db = getDb();

  const links = await db
    .select({ destinationId: groupDestinations.destinationId })
    .from(groupDestinations)
    .where(eq(groupDestinations.groupId, groupId))
    .all();

  if (links.length === 0) return [];

  const results = await Promise.allSettled(
    links.map((link) => uploadVideoToDestination(link.destinationId, input))
  );

  return results.map((r) => {
    if (r.status === "fulfilled") return r.value;
    return {
      destinationId: "unknown",
      destinationName: "unknown",
      status: "error" as const,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });
}
