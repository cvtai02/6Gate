import { getDb } from "@/server/db";
import { accounts, providers, publishDestinations } from "@/server/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { nanoid } from "nanoid";

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

  if (provider.type !== "facebook") {
    return Response.json({ error: "Sync is only supported for Facebook accounts" }, { status: 400 });
  }

  try {
    let warning: string | undefined;

    if (provider.type === "youtube") {
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
          await upsertDestination(id, "youtube_channel", channel.snippet?.title ?? "YouTube Channel", channel.id);
        } else {
          await ensureFallback(id, "youtube_channel", account.displayName ?? "YouTube Channel", account.providerAccountId);
        }
      } else {
        const errBody = await channelRes.json().catch(() => null);
        const reason = errBody?.error?.errors?.[0]?.reason ?? "";
        const apiMsg = errBody?.error?.message ?? `HTTP ${channelRes.status}`;
        console.error(`YouTube channels API error (${channelRes.status}) [${reason}]:`, apiMsg);
        await ensureFallback(id, "youtube_channel", account.displayName ?? "YouTube Channel", account.providerAccountId);

        if (reason === "insufficientPermissions" || (channelRes.status === 403 && apiMsg.toLowerCase().includes("scope"))) {
          warning = `Missing youtube.readonly scope. Click "Edit Provider" → add youtube.readonly to scopes → Disconnect → Reconnect.`;
        } else if (reason === "accessNotConfigured" || apiMsg.includes("has not been used")) {
          warning = `YouTube Data API v3 is not enabled. Enable it at console.cloud.google.com/apis then click Sync again.`;
        } else {
          warning = `YouTube API error: ${apiMsg}`;
        }
      }
    } else if (provider.type === "facebook") {
      const pageRes = await fetch(
        `https://graph.facebook.com/v21.0/${account.providerAccountId}?fields=id,name&access_token=${account.accessToken}`
      );
      const pageName = pageRes.ok ? (await pageRes.json()).name : (account.displayName ?? "Facebook Page");
      if (!isPlaceholderId(account.providerAccountId)) {
        await upsertDestination(id, "facebook_page", pageName, account.providerAccountId!);
      } else {
        await ensureFallback(id, "facebook_page", pageName, null);
      }
    } else if (provider.type === "tiktok") {
      const userRes = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_large_url,avatar_url,username,profile_deep_link",
        { headers: { Authorization: `Bearer ${account.accessToken}` } }
      );
      if (userRes.ok) {
        const userData = await userRes.json();
        const user = userData.data?.user ?? {};
        const freshExternalId = user.open_id ?? account.providerAccountId;
        const displayName = user.display_name ?? account.displayName ?? "TikTok Account";
        // Update account username/avatar from live API data
        await db.update(accounts).set({
          username: user.username ?? account.username,
          displayName,
          avatarUrl: user.avatar_large_url ?? user.avatar_url ?? account.avatarUrl,
          providerAccountId: !isPlaceholderId(freshExternalId) ? freshExternalId : account.providerAccountId,
          updatedAt: new Date().toISOString(),
        }).where(eq(accounts.id, id));

        if (!isPlaceholderId(freshExternalId)) {
          await upsertDestination(id, "tiktok_account", displayName, freshExternalId!);
        } else {
          await ensureFallback(id, "tiktok_account", displayName, null);
        }
      } else {
        await ensureFallback(id, "tiktok_account", account.displayName ?? "TikTok Account", account.providerAccountId);
      }
    } else if (provider.type === "instagram") {
      if (!isPlaceholderId(account.providerAccountId)) {
        await upsertDestination(id, "instagram_account", account.displayName ?? "Instagram Account", account.providerAccountId!);
      } else {
        await ensureFallback(id, "instagram_account", account.displayName ?? "Instagram Account", null);
      }
    }

    const dests = await db.select().from(publishDestinations).where(eq(publishDestinations.socialAccountId, id)).all();
    return Response.json({ destinations: dests, warning });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
