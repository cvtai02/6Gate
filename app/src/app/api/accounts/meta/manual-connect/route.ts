import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { accounts, providers, publishDestinations } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { ProviderType, DestinationType } from "@/lib/enums";
import { syncInstagramForPage, syncThreadsForUser } from "@/server/providers/meta-ig-threads";

export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const { providerId, appId, appSecret, accessToken } = body as {
    providerId?: string;
    appId?: string;
    appSecret?: string;
    accessToken?: string;
  };

  if (!providerId || !appId || !appSecret || !accessToken) {
    return Response.json(
      { error: "providerId, appId, appSecret, and accessToken are required" },
      { status: 400 }
    );
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

  // Exchange the user token for a long-lived token (60 days)
  const longRes = await fetch(
    `${GRAPH}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: accessToken,
      })
  );

  if (!longRes.ok) {
    const err = await longRes.json().catch(() => ({})) as { error?: { message?: string } };
    return Response.json(
      { error: err.error?.message ?? `Token exchange failed (HTTP ${longRes.status})` },
      { status: 400 }
    );
  }

  const { access_token: longToken } = await longRes.json() as { access_token: string };

  // Get the Facebook user's identity
  const meRes = await fetch(
    `${GRAPH}/me?fields=id,name,picture.type(large)&access_token=${longToken}`
  );
  if (!meRes.ok) {
    const err = await meRes.json().catch(() => ({})) as { error?: { message?: string } };
    return Response.json(
      { error: err.error?.message ?? `Failed to fetch user identity (HTTP ${meRes.status})` },
      { status: 400 }
    );
  }
  const me = await meRes.json() as { id: string; name: string; picture?: { data?: { url?: string } } };

  // Fetch pages managed by this user (include page picture + page-level token)
  const pagesRes = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token,picture.type(large)&access_token=${longToken}`
  );

  if (!pagesRes.ok) {
    const err = await pagesRes.json().catch(() => ({})) as { error?: { message?: string } };
    return Response.json(
      { error: err.error?.message ?? `Failed to fetch pages (HTTP ${pagesRes.status})` },
      { status: 400 }
    );
  }

  const { data: pages } = await pagesRes.json() as {
    data: { id: string; name: string; access_token: string; picture?: { data?: { url?: string } } }[];
  };

  if (!pages || pages.length === 0) {
    return Response.json(
      {
        error:
          "No Facebook Pages found. Ensure your token has the pages_show_list permission and you manage at least one Page.",
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const result = { added: 0, skipped: 0 };

  // Upsert one account for this Facebook user (keyed by Facebook user ID)
  const existingUserAcc = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.providerId, providerId), eq(accounts.providerAccountId, me.id)))
    .get();

  let userAccountId: string;
  if (existingUserAcc) {
    await db.update(accounts).set({
      displayName: me.name,
      avatarUrl: me.picture?.data?.url ?? existingUserAcc.avatarUrl,
      accessToken: longToken,
      refreshToken: longToken,
      updatedAt: now,
    }).where(eq(accounts.id, existingUserAcc.id));
    userAccountId = existingUserAcc.id;
  } else {
    userAccountId = `acc_fb_${nanoid(8)}`;
    await db.insert(accounts).values({
      id: userAccountId,
      providerId,
      providerAccountId: me.id,
      displayName: me.name,
      username: null,
      avatarUrl: me.picture?.data?.url ?? null,
      accessToken: longToken,
      refreshToken: longToken,
      expiresAt: null,
      scopes: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Upsert one destination per page under the user account, plus Instagram/Threads
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
      result.skipped++;
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
      result.added++;
    }

    // Sync Instagram Business account connected to this page
    await syncInstagramForPage(userAccountId, page.id, page.access_token, now);
  }

  // Sync Threads profile (best-effort)
  await syncThreadsForUser(userAccountId, longToken, now);

  return Response.json(result);
}
