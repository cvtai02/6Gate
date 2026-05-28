import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { accounts, providers, publishDestinations, postJobs, jobLogs, groupDestinations } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { ProviderType, DestinationType } from "@/lib/enums";
import { syncInstagramForPage, syncThreadsForUser } from "@/server/providers/meta-ig-threads";

export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v21.0";

type FbPage = {
  id: string;
  name: string;
  access_token: string;
  picture?: { data?: { url?: string } };
};

type FbMe = {
  id: string;
  name: string;
  picture?: { data?: { url?: string } };
};

async function fetchMe(userToken: string): Promise<FbMe | null> {
  const res = await fetch(
    `${GRAPH}/me?fields=id,name,picture.type(large)&access_token=${userToken}`
  );
  if (!res.ok) return null;
  return res.json() as Promise<FbMe>;
}

async function fetchPages(userToken: string): Promise<FbPage[]> {
  const res = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token,picture.type(large)&access_token=${userToken}`
  );
  if (!res.ok) return [];
  const { data } = await res.json() as { data?: FbPage[] };
  return data ?? [];
}

/**
 * Delete an account row and its post jobs / logs.
 * Destinations must already be migrated away before calling this.
 */
async function deleteAccountOnly(id: string) {
  const db = getDb();
  const jobs = await db.select({ id: postJobs.id }).from(postJobs).where(eq(postJobs.accountId, id)).all();
  for (const job of jobs) {
    await db.delete(jobLogs).where(eq(jobLogs.jobId, job.id));
  }
  await db.delete(postJobs).where(eq(postJobs.accountId, id));
  await db.delete(accounts).where(eq(accounts.id, id));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { providerId } = (body ?? {}) as { providerId?: string };

  if (!providerId) {
    return Response.json({ error: "providerId is required" }, { status: 400 });
  }

  const db = getDb();

  const provider = await db
    .select()
    .from(providers)
    .where(eq(providers.id, providerId))
    .get();
  if (!provider) return Response.json({ error: "Provider not found" }, { status: 404 });
  if (provider.type !== ProviderType.meta)
    return Response.json({ error: "Provider is not a Meta provider" }, { status: 400 });

  const existingAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.providerId, providerId))
    .all();

  // Collect every unique long-lived user token across all connected accounts.
  // Each token belongs to a different Facebook user managing different pages.
  const uniqueTokens = [...new Set(
    existingAccounts.map((a) => a.refreshToken).filter(Boolean) as string[]
  )];

  if (uniqueTokens.length === 0) {
    return Response.json(
      { error: "No connected accounts found. Use 'Add Manually' or 'Connect Account' first." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const result = { created: 0, updated: 0, deleted: 0 };

  // Track which account IDs survive after the sync (one per Facebook user)
  const survivingAccountIds = new Set<string>();

  for (const userToken of uniqueTokens) {
    // 1. Resolve the Facebook user behind this token
    const me = await fetchMe(userToken);
    if (!me) {
      console.log(`[meta/sync] token=${userToken.slice(0, 12)}… /me failed — skipping (expired?)`);
      continue;
    }
    console.log(`[meta/sync] token=${userToken.slice(0, 12)}… → user id=${me.id} name="${me.name}"`);

    // 2. Find or create one account for this Facebook user (keyed by Facebook user ID)
    let userAccountId: string;
    const existingUserAcc = existingAccounts.find((a) => a.providerAccountId === me.id);

    if (existingUserAcc) {
      await db.update(accounts).set({
        displayName: me.name,
        avatarUrl: me.picture?.data?.url ?? existingUserAcc.avatarUrl,
        accessToken: userToken,
        refreshToken: userToken,
        updatedAt: now,
      }).where(eq(accounts.id, existingUserAcc.id));
      userAccountId = existingUserAcc.id;
      result.updated++;
    } else {
      userAccountId = `acc_fb_${nanoid(8)}`;
      await db.insert(accounts).values({
        id: userAccountId,
        providerId,
        providerAccountId: me.id,
        displayName: me.name,
        username: null,
        avatarUrl: me.picture?.data?.url ?? null,
        accessToken: userToken,
        refreshToken: userToken,
        expiresAt: null,
        scopes: null,
        createdAt: now,
        updatedAt: now,
      });
      result.created++;
    }
    survivingAccountIds.add(userAccountId);

    // 3. Fetch all pages managed by this user
    const pages = await fetchPages(userToken);
    console.log(`[meta/sync] user ${me.id} has ${pages.length} page(s):`, pages.map(p => `${p.id} (${p.name})`));
    const seenPageIds = new Set(pages.map((p) => p.id));

    // 4. Find old per-page accounts sharing this token (created by the old model)
    const oldPageAccounts = existingAccounts.filter(
      (a) =>
        a.refreshToken === userToken &&
        a.id !== userAccountId &&
        !survivingAccountIds.has(a.id)
    );

    for (const old of oldPageAccounts) {
      console.log(`[meta/sync] merging old per-page account ${old.id} (page=${old.providerAccountId}) → user account ${userAccountId}`);

      const oldDests = await db
        .select()
        .from(publishDestinations)
        .where(eq(publishDestinations.socialAccountId, old.id))
        .all();

      for (const dest of oldDests) {
        if (dest.externalId && seenPageIds.has(dest.externalId)) {
          // The new user account will have a destination for this page — redirect group links
          const newDest = await db
            .select({ id: publishDestinations.id })
            .from(publishDestinations)
            .where(and(
              eq(publishDestinations.socialAccountId, userAccountId),
              eq(publishDestinations.externalId, dest.externalId)
            ))
            .get();
          if (newDest) {
            await db
              .update(groupDestinations)
              .set({ destinationId: newDest.id })
              .where(eq(groupDestinations.destinationId, dest.id));
          }
        }
        // Remove old destination (group links already redirected)
        await db.delete(groupDestinations).where(eq(groupDestinations.destinationId, dest.id));
        await db.delete(publishDestinations).where(eq(publishDestinations.id, dest.id));
      }

      // Preserve job history by moving post jobs to the user account
      await db.update(postJobs).set({ accountId: userAccountId }).where(eq(postJobs.accountId, old.id));

      await deleteAccountOnly(old.id);
      result.deleted++;
    }

    // 5. Upsert one destination per page under the user account, plus Instagram/Threads
    for (const page of pages) {
      const existingDest = await db
        .select({ id: publishDestinations.id })
        .from(publishDestinations)
        .where(and(
          eq(publishDestinations.socialAccountId, userAccountId),
          eq(publishDestinations.externalId, page.id)
        ))
        .get();

      const pageAvatarUrl = page.picture?.data?.url ?? null;
      if (existingDest) {
        await db.update(publishDestinations).set({
          name: page.name,
          accessToken: page.access_token,
          avatarUrl: pageAvatarUrl,
        }).where(eq(publishDestinations.id, existingDest.id));
      } else {
        await db.insert(publishDestinations).values({
          id: `dest_${nanoid(8)}`,
          socialAccountId: userAccountId,
          name: page.name,
          type: DestinationType.facebook_page,
          externalId: page.id,
          accessToken: page.access_token,
          avatarUrl: pageAvatarUrl,
          createdAt: now,
        });
      }

      // Sync Instagram Business account connected to this page
      await syncInstagramForPage(userAccountId, page.id, page.access_token, now);
    }

    // Sync Threads profile (best-effort)
    await syncThreadsForUser(userAccountId, userToken, now);

    // 6. Delete facebook_page destinations for pages no longer visible from this user
    const allUserDests = await db
      .select()
      .from(publishDestinations)
      .where(eq(publishDestinations.socialAccountId, userAccountId))
      .all();
    for (const dest of allUserDests) {
      if (dest.type === DestinationType.facebook_page && dest.externalId && !seenPageIds.has(dest.externalId)) {
        console.log(`[meta/sync] removing stale destination ${dest.id} (page=${dest.externalId}) from user account ${userAccountId}`);
        await db.delete(groupDestinations).where(eq(groupDestinations.destinationId, dest.id));
        await db.delete(publishDestinations).where(eq(publishDestinations.id, dest.id));
      }
    }
  }

  console.log(`[meta/sync] done — surviving accounts:`, [...survivingAccountIds]);
  return Response.json(result);
}
