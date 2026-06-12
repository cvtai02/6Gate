import { nanoid } from "nanoid";
import { getDb } from "@/infrastructure/db";
import { destinations } from "@/infrastructure/db/schema";
import { eq, and } from "drizzle-orm";
import { DestinationType } from "@/core/enums";

const GRAPH = "https://graph.facebook.com/v21.0";
const THREADS_GRAPH = "https://graph.threads.net/v1.0";

async function upsertDestination(
  accountId: string,
  type: string,
  externalId: string,
  name: string,
  accessToken: string,
  avatarUrl: string | null,
  now: string
) {
  const db = getDb();
  const existing = await db
    .select({ id: destinations.id })
    .from(destinations)
    .where(and(eq(destinations.socialAccountId, accountId), eq(destinations.externalId, externalId)))
    .then((r) => r[0]);
  if (existing) {
    await db.update(destinations)
      .set({ name, accessToken, avatarUrl })
      .where(eq(destinations.id, existing.id));
  } else {
    await db.insert(destinations).values({
      id: `dest_${nanoid(8)}`, socialAccountId: accountId, name, type,
      externalId, accessToken, avatarUrl, createdAt: now,
    });
  }
}

/**
 * Fetch the Instagram Business account connected to a Facebook Page and upsert
 * it as an instagram_account destination. Returns the IG account ID on success.
 */
export async function syncInstagramForPage(
  accountId: string,
  pageId: string,
  pageToken: string,
  now: string
): Promise<string | null> {
  try {
    const igPageRes = await fetch(
      `${GRAPH}/${pageId}?fields=instagram_business_account&access_token=${pageToken}`
    );
    if (!igPageRes.ok) return null;
    const igPageData = await igPageRes.json() as { instagram_business_account?: { id: string } };
    const igId = igPageData.instagram_business_account?.id;
    if (!igId) return null;

    const igInfoRes = await fetch(
      `${GRAPH}/${igId}?fields=id,name,username,profile_picture_url&access_token=${pageToken}`
    );
    if (!igInfoRes.ok) return igId;
    const igInfo = await igInfoRes.json() as {
      id: string; name?: string; username?: string; profile_picture_url?: string;
    };
    const igName = igInfo.name ?? igInfo.username ?? "Instagram Account";

    await upsertDestination(accountId, DestinationType.instagram_account, igId, igName, pageToken, igInfo.profile_picture_url ?? null, now);
    return igId;
  } catch (err) {
    console.error("[syncInstagramForPage] error:", err);
    return null;
  }
}

/**
 * Try to fetch the Threads profile for the given user token and upsert it as a
 * threads_profile destination. Gracefully fails if the token lacks threads_basic.
 */
export async function syncThreadsForUser(
  accountId: string,
  userToken: string,
  now: string
): Promise<void> {
  try {
    const thrRes = await fetch(
      `${THREADS_GRAPH}/me?fields=id,username,name,threads_profile_picture_url&access_token=${userToken}`
    );
    if (!thrRes.ok) return;
    const thr = await thrRes.json() as {
      id?: string; username?: string; name?: string;
      threads_profile_picture_url?: string; error?: unknown;
    };
    if (!thr.id || thr.error) return;
    const thrName = thr.name ?? thr.username ?? "Threads Profile";
    await upsertDestination(accountId, DestinationType.threads_profile, thr.id, thrName, userToken, thr.threads_profile_picture_url ?? null, now);
  } catch {
    // Not granted threads_basic — silently skip
  }
}
