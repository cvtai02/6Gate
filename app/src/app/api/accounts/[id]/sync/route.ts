import { getDb } from "@/server/db";
import { accounts, providers, publishDestinations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type SyncedProfile = {
  displayName?: string;
  username?: string;
  avatarUrl?: string;
};

/**
 * Try /v2/user/info/ (requires user.info.basic scope).
 * Returns null if scope_not_authorized or any error.
 */
async function fetchUserInfo(accessToken: string): Promise<SyncedProfile | null> {
  try {
    const res = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name,avatar_url,avatar_url_100,avatar_large_url,username,bio_description,profile_deep_link,is_verified",
      {
        signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.error?.code === "scope_not_authorized" || (body?.error?.code && body.error.code !== "ok")) {
      console.warn("[TikTok sync] user/info failed:", body?.error?.code ?? res.status);
      return null;
    }
    const user = body?.data?.user;
    if (!user) return null;
    return {
      displayName: user.display_name,
      username: user.username,
      avatarUrl: user.avatar_large_url ?? user.avatar_url,
    };
  } catch (e) {
    console.warn("[TikTok sync] user/info threw:", e);
    return null;
  }
}

/**
 * Fallback: /v2/post/publish/creator_info/query/ (requires only video.publish scope).
 * Returns creator_username, creator_nickname, creator_avatar_url.
 */
async function fetchCreatorInfo(accessToken: string): Promise<SyncedProfile | null> {
  try {
    const res = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
      {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      }
    );
    const body = await res.json().catch(() => null);
    if (!res.ok || (body?.error?.code && body.error.code !== "ok")) {
      console.warn("[TikTok sync] creator_info failed:", body?.error?.code ?? res.status, body);
      return null;
    }
    const data = body?.data;
    if (!data) return null;
    return {
      displayName: data.creator_nickname,
      username: data.creator_username,
      avatarUrl: data.creator_avatar_url,
    };
  } catch (e) {
    console.warn("[TikTok sync] creator_info threw:", e);
    return null;
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const account = await db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!account) return Response.json({ error: "Account not found" }, { status: 404 });

  const provider = await db.select().from(providers).where(eq(providers.id, account.providerId)).get();
  if (!provider) return Response.json({ error: "Provider not found" }, { status: 404 });

  if (provider.type !== "tiktok") {
    return Response.json({ error: "Sync only supported for TikTok" }, { status: 400 });
  }

  if (!account.accessToken) {
    return Response.json({ error: "No access token" }, { status: 400 });
  }

  // Try user.info.basic first; fall back to creator_info (only needs video.publish).
  const profile =
    (await fetchUserInfo(account.accessToken)) ??
    (await fetchCreatorInfo(account.accessToken));

  if (!profile) {
    return Response.json({ ok: true, skipped: true, reason: "no_profile_available" });
  }

  const now = new Date().toISOString();
  const displayName = profile.displayName ?? account.displayName ?? "TikTok User";
  const username = profile.username ?? account.username ?? null;
  const avatarUrl = profile.avatarUrl ?? account.avatarUrl ?? null;

  await db.update(accounts).set({
    displayName,
    username,
    avatarUrl,
    updatedAt: now,
  }).where(eq(accounts.id, id));

  await db.update(publishDestinations).set({
    name: displayName,
    avatarUrl,
  }).where(eq(publishDestinations.socialAccountId, id));

  return Response.json({ ok: true, displayName, username, avatarUrl });
}
