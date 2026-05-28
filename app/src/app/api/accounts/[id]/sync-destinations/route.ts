import { getDb } from "@/server/db";
import { accounts, providers, publishDestinations, groupDestinations } from "@/server/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ProviderType, DestinationType } from "@/lib/enums";
import { syncInstagramForPage, syncThreadsForUser } from "@/server/providers/meta-ig-threads";

export const dynamic = "force-dynamic";

function isPlaceholderId(v: string | null | undefined): boolean {
  return !v || v === "unknown";
}

/**
 * Upsert with promotion: if a destination with the real externalId already exists,
 * return it. If a placeholder (null/"unknown" externalId) for this account+type
 * exists, update it with the real ID and name. Otherwise insert fresh.
 */
async function upsertDestination(
  socialAccountId: string,
  type: string,
  name: string,
  externalId: string
) {
  const db = getDb();

  // Already stored with the correct channel/page ID — update name in case it changed
  const exact = await db
    .select({ id: publishDestinations.id })
    .from(publishDestinations)
    .where(and(eq(publishDestinations.socialAccountId, socialAccountId), eq(publishDestinations.externalId, externalId)))
    .get();
  if (exact) {
    await db.update(publishDestinations).set({ name }).where(eq(publishDestinations.id, exact.id));
    return exact.id;
  }

  // Promote a placeholder to use the real ID
  const placeholder = await db
    .select({ id: publishDestinations.id })
    .from(publishDestinations)
    .where(
      and(
        eq(publishDestinations.socialAccountId, socialAccountId),
        eq(publishDestinations.type, type),
        or(isNull(publishDestinations.externalId), eq(publishDestinations.externalId, "unknown"))
      )
    )
    .get();

  if (placeholder) {
    await db
      .update(publishDestinations)
      .set({ name, externalId })
      .where(eq(publishDestinations.id, placeholder.id));
    return placeholder.id;
  }

  const id = `dest_${nanoid(8)}`;
  await db.insert(publishDestinations).values({
    id, socialAccountId, name, type, externalId,
    createdAt: new Date().toISOString(),
  });
  return id;
}

/**
 * Like upsertDestination but also writes an accessToken and avatarUrl (Meta pages).
 */
async function upsertDestinationWithToken(
  socialAccountId: string,
  type: string,
  name: string,
  externalId: string,
  accessToken: string,
  avatarUrl?: string | null
) {
  const db = getDb();

  const exact = await db
    .select({ id: publishDestinations.id })
    .from(publishDestinations)
    .where(and(eq(publishDestinations.socialAccountId, socialAccountId), eq(publishDestinations.externalId, externalId)))
    .get();
  if (exact) {
    await db.update(publishDestinations).set({ name, accessToken, ...(avatarUrl !== undefined && { avatarUrl }) }).where(eq(publishDestinations.id, exact.id));
    return exact.id;
  }

  const placeholder = await db
    .select({ id: publishDestinations.id })
    .from(publishDestinations)
    .where(
      and(
        eq(publishDestinations.socialAccountId, socialAccountId),
        eq(publishDestinations.type, type),
        or(isNull(publishDestinations.externalId), eq(publishDestinations.externalId, "unknown"))
      )
    )
    .get();

  if (placeholder) {
    await db
      .update(publishDestinations)
      .set({ name, externalId, accessToken, ...(avatarUrl !== undefined && { avatarUrl }) })
      .where(eq(publishDestinations.id, placeholder.id));
    return placeholder.id;
  }

  const id = `dest_${nanoid(8)}`;
  await db.insert(publishDestinations).values({
    id, socialAccountId, name, type, externalId, accessToken,
    avatarUrl: avatarUrl ?? null,
    createdAt: new Date().toISOString(),
  });
  return id;
}

/** Ensure at least one destination exists; used as fallback when the API gives nothing. */
async function ensureFallback(
  socialAccountId: string,
  type: string,
  name: string,
  externalId: string | null
) {
  const db = getDb();
  const existing = await db
    .select({ id: publishDestinations.id })
    .from(publishDestinations)
    .where(and(eq(publishDestinations.socialAccountId, socialAccountId), eq(publishDestinations.type, type)))
    .get();
  if (existing) return existing.id;

  const id = `dest_${nanoid(8)}`;
  await db.insert(publishDestinations).values({
    id, socialAccountId, name, type,
    externalId: isPlaceholderId(externalId) ? null : externalId,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const account = await db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!account) return Response.json({ error: "Not found" }, { status: 404 });

  const provider = await db.select().from(providers).where(eq(providers.id, account.providerId)).get();
  if (!provider) return Response.json({ error: "Provider not found" }, { status: 404 });

  if (![ProviderType.youtube, ProviderType.tiktok, ProviderType.meta].includes(provider.type as ProviderType)) {
    return Response.json({ error: "Sync is not supported for this provider" }, { status: 400 });
  }

  try {
    let warning: string | undefined;

    if (provider.type === ProviderType.youtube) {
      let accessToken = account.accessToken!;
      if (account.refreshToken && provider.clientId && provider.clientSecret) {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            refresh_token: account.refreshToken,
            client_id: provider.clientId,
            client_secret: provider.clientSecret,
            grant_type: "refresh_token",
          }),
        });
        if (tokenRes.ok) {
          const tokens = await tokenRes.json();
          accessToken = tokens.access_token;
          await db.update(accounts).set({
            accessToken,
            expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
            updatedAt: new Date().toISOString(),
          }).where(eq(accounts.id, id));
        }
      }

      const channelRes = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (channelRes.ok) {
        const data = await channelRes.json();
        type YTChannel = {
          id: string;
          snippet?: {
            title?: string;
            customUrl?: string;
            thumbnails?: { default?: { url?: string }; medium?: { url?: string }; high?: { url?: string } };
          };
          statistics?: { subscriberCount?: string; videoCount?: string };
        };
        const channels: YTChannel[] = data.items ?? [];
        const channel = channels[0];
        if (channel) {
          const thumbs = channel.snippet?.thumbnails;
          const avatarUrl = thumbs?.high?.url ?? thumbs?.medium?.url ?? thumbs?.default?.url ?? null;
          // Refresh stored account metadata from live API data
          await db.update(accounts).set({
            displayName: channel.snippet?.title ?? account.displayName,
            username: channel.snippet?.customUrl ?? account.username,
            avatarUrl: avatarUrl ?? account.avatarUrl,
            providerAccountId: channel.id,
            updatedAt: new Date().toISOString(),
          }).where(eq(accounts.id, id));
          await upsertDestination(id, DestinationType.youtube_channel, channel.snippet?.title ?? "YouTube Channel", channel.id);
        } else {
          await ensureFallback(id, DestinationType.youtube_channel, account.displayName ?? "YouTube Channel", account.providerAccountId);
        }
      } else {
        const errBody = await channelRes.json().catch(() => null);
        const reason = errBody?.error?.errors?.[0]?.reason ?? "";
        const apiMsg = errBody?.error?.message ?? `HTTP ${channelRes.status}`;
        console.error(`YouTube channels API error (${channelRes.status}) [${reason}]:`, apiMsg);
        await ensureFallback(id, DestinationType.youtube_channel, account.displayName ?? "YouTube Channel", account.providerAccountId);

        if (reason === "insufficientPermissions" || (channelRes.status === 403 && apiMsg.toLowerCase().includes("scope"))) {
          warning = `Missing youtube.readonly scope. Click "Edit Provider" → add youtube.readonly to scopes → Disconnect → Reconnect.`;
        } else if (reason === "accessNotConfigured" || apiMsg.includes("has not been used")) {
          warning = `YouTube Data API v3 is not enabled. Enable it at console.cloud.google.com/apis then click Sync again.`;
        } else {
          warning = `YouTube API error: ${apiMsg}`;
        }
      }
    } else if (provider.type === ProviderType.meta) {
      // The account represents a Facebook USER; destinations are the pages they manage.
      // Re-fetch all pages using the stored user token and upsert destinations.
      const userToken = account.refreshToken ?? account.accessToken;
      if (!userToken) {
        warning = "No user token stored — use 'Add Manually' or 'Connect Account' to reconnect.";
      } else {
        // Refresh the user's display info
        const meRes = await fetch(
          `https://graph.facebook.com/v21.0/me?fields=id,name,picture.type(large)&access_token=${userToken}`
        );
        if (meRes.ok) {
          const me = await meRes.json() as { id: string; name: string; picture?: { data?: { url?: string } } };
          await db.update(accounts).set({
            displayName: me.name,
            avatarUrl: me.picture?.data?.url ?? account.avatarUrl,
            providerAccountId: me.id,
            updatedAt: new Date().toISOString(),
          }).where(eq(accounts.id, id));
        }

        // Fetch all pages managed by this user
        const pagesRes = await fetch(
          `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,picture.type(large)&access_token=${userToken}`
        );
        if (!pagesRes.ok) {
          warning = `Failed to fetch pages from Facebook (HTTP ${pagesRes.status}). Token may have expired — use 'Add Manually' to reconnect.`;
          await ensureFallback(id, DestinationType.facebook_page, account.displayName ?? "Facebook Page", null);
        } else {
          const { data: pages } = await pagesRes.json() as {
            data?: { id: string; name: string; access_token: string; picture?: { data?: { url?: string } } }[];
          };
          if (!pages || pages.length === 0) {
            warning = "No Facebook Pages returned for this account.";
            await ensureFallback(id, DestinationType.facebook_page, account.displayName ?? "Facebook Page", null);
          } else {
            const seenPageIds = new Set(pages.map((p) => p.id));

            const now = new Date().toISOString();

            // Upsert one destination per page, plus Instagram/Threads
            for (const page of pages) {
              await upsertDestinationWithToken(id, DestinationType.facebook_page, page.name, page.id, page.access_token, page.picture?.data?.url ?? null);
              await syncInstagramForPage(id, page.id, page.access_token, now);
            }

            // Sync Threads profile (best-effort)
            await syncThreadsForUser(id, userToken, now);

            // Remove facebook_page destinations for pages no longer in the list
            const allDests = await db.select().from(publishDestinations).where(eq(publishDestinations.socialAccountId, id)).all();
            for (const dest of allDests) {
              if (dest.type === DestinationType.facebook_page && dest.externalId && !seenPageIds.has(dest.externalId)) {
                await db.delete(groupDestinations).where(eq(groupDestinations.destinationId, dest.id));
                await db.delete(publishDestinations).where(eq(publishDestinations.id, dest.id));
              }
            }
          }
        }
      }
    } else if (provider.type === ProviderType.tiktok) {
      // Refresh the access token first — TikTok tokens expire after 24 hours
      let accessToken = account.accessToken!;
      console.log(`[TikTok sync] account=${id} hasRefreshToken=${!!account.refreshToken} hasClientId=${!!provider.clientId} hasClientSecret=${!!provider.clientSecret}`);

      if (account.refreshToken && provider.clientId && provider.clientSecret) {
        const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_key: provider.clientId,
            client_secret: provider.clientSecret,
            grant_type: "refresh_token",
            refresh_token: account.refreshToken,
          }),
        });
        const tokenJson = await tokenRes.json().catch(() => ({}));
        console.log(`[TikTok sync] token refresh HTTP=${tokenRes.status} body=`, JSON.stringify(tokenJson));
        const d = tokenJson.data ?? tokenJson;
        if (tokenRes.ok && d.access_token && (!tokenJson.error?.code || tokenJson.error.code === "ok")) {
          accessToken = d.access_token;
          await db.update(accounts).set({
            accessToken,
            refreshToken: d.refresh_token ?? account.refreshToken,
            expiresAt: d.expires_in ? new Date(Date.now() + d.expires_in * 1000).toISOString() : null,
            updatedAt: new Date().toISOString(),
          }).where(eq(accounts.id, id));
          console.log(`[TikTok sync] token refreshed OK, new expiresIn=${d.expires_in}`);
        } else {
          console.log(`[TikTok sync] token refresh failed — using stored token`);
        }
      } else {
        console.log(`[TikTok sync] skipping token refresh (missing refreshToken or client credentials)`);
      }

      // Only request fields covered by user.info.basic scope.
      // username / profile_deep_link require user.info.profile — requesting them when
      // that scope is absent causes TikTok to reject the entire call.
      const basicFields = "open_id,display_name,avatar_url,avatar_large_url";

      // If user.info.profile scope was granted, also fetch username.
      const storedScopes = (account.scopes ?? provider.scopes ?? "").split(/[,\s]+/);
      const hasProfileScope = storedScopes.includes("user.info.profile");
      const fields = hasProfileScope ? `${basicFields},username` : basicFields;

      const userRes = await fetch(
        `https://open.tiktokapis.com/v2/user/info/?fields=${fields}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const userData = await userRes.json().catch(() => ({}));
      console.log(`[TikTok sync] user/info HTTP=${userRes.status} fields=${fields} body=`, JSON.stringify(userData));

      if (userRes.ok) {
        // TikTok returns HTTP 200 even on token errors — check the error field
        if (userData.error?.code && userData.error.code !== "ok") {
          warning = `TikTok API error: ${userData.error.message ?? userData.error.code}. Try disconnecting and reconnecting this account.`;
          await ensureFallback(id, DestinationType.tiktok_account, account.displayName ?? "TikTok Account", account.providerAccountId);
        } else {
          const user = userData.data?.user ?? {};
          const freshExternalId = user.open_id ?? account.providerAccountId;
          const displayName = user.display_name ?? account.displayName ?? "TikTok Account";
          console.log(`[TikTok sync] user data: display_name=${user.display_name} avatar_url=${user.avatar_url} avatar_large_url=${user.avatar_large_url} username=${user.username ?? "(not fetched)"}`);
          await db.update(accounts).set({
            // Preserve existing username if user.info.profile scope wasn't granted
            ...(user.username !== undefined && { username: user.username }),
            displayName,
            avatarUrl: user.avatar_large_url ?? user.avatar_url ?? account.avatarUrl,
            providerAccountId: !isPlaceholderId(freshExternalId) ? freshExternalId : account.providerAccountId,
            updatedAt: new Date().toISOString(),
          }).where(eq(accounts.id, id));

          if (!isPlaceholderId(freshExternalId)) {
            await upsertDestination(id, DestinationType.tiktok_account, displayName, freshExternalId!);
          } else {
            await ensureFallback(id, DestinationType.tiktok_account, displayName, null);
          }
        }
      } else {
        const msg = userData?.error?.message ?? `HTTP ${userRes.status}`;
        warning = `TikTok API error: ${msg}. Token may be expired — disconnect and reconnect this account.`;
        await ensureFallback(id, DestinationType.tiktok_account, account.displayName ?? "TikTok Account", account.providerAccountId);
      }
    }

    const dests = await db.select().from(publishDestinations).where(eq(publishDestinations.socialAccountId, id)).all();
    return Response.json({ destinations: dests, warning });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
