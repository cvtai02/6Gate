import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { accounts, publishDestinations } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { SocialProviderAdapter, PublishVideoInput, PublishVideoResult } from "./types";
import {
  REDIRECT_URI,
  getProviderRecord,
  getAccountRecord,
  readVideoFile,
  checkHttpOk,
} from "./adapter-utils";
import { ProviderType, DestinationType } from "@/lib/enums";
import { syncInstagramForPage, syncThreadsForUser } from "./meta-ig-threads";

const GRAPH = "https://graph.facebook.com/v21.0";
const GRAPH_VIDEO = "https://graph-video.facebook.com/v21.0";
export const FACEBOOK_DEFAULT_SCOPES =
  "pages_manage_posts,pages_read_engagement,pages_show_list,publish_video";

const PRIVACY_MAP: Record<string, string> = {
  public: "EVERYONE",
  private: "SELF",
  unlisted: "ALL_FRIENDS",
};

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

export class FacebookAdapter implements SocialProviderAdapter {
  id = ProviderType.meta;
  name = "Facebook";

  async getAuthUrl(providerId: string): Promise<string> {
    const provider = await getProviderRecord(providerId);
    const scopes = provider.scopes ?? FACEBOOK_DEFAULT_SCOPES;

    const params = new URLSearchParams({
      client_id: provider.clientId!,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: scopes,
      state: providerId,
    });

    return `${GRAPH}/dialog/oauth?${params}`;
  }

  async handleOAuthCallback(input: {
    providerId: string;
    code: string;
    state?: string;
  }): Promise<void> {
    const provider = await getProviderRecord(input.providerId);

    // Exchange code for short-lived user token
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          client_id: provider.clientId!,
          client_secret: provider.clientSecret!,
          redirect_uri: REDIRECT_URI,
          code: input.code,
        })
    );
    await checkHttpOk(tokenRes, "Facebook token exchange");
    const { access_token: shortToken } = await tokenRes.json();

    // Exchange for long-lived user token (60 days)
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: provider.clientId!,
          client_secret: provider.clientSecret!,
          fb_exchange_token: shortToken,
        })
    );
    await checkHttpOk(longRes, "Facebook long-lived token exchange");
    const { access_token: longToken } = await longRes.json();

    // Get the Facebook user's identity
    const meRes = await fetch(
      `${GRAPH}/me?fields=id,name,picture.type(large)&access_token=${longToken}`
    );
    await checkHttpOk(meRes, "Facebook get user identity");
    const me = await meRes.json() as FbMe;

    // Get pages managed by this user (include page picture + page token)
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?fields=id,name,access_token,picture.type(large)&access_token=${longToken}`
    );
    await checkHttpOk(pagesRes, "Facebook get pages");
    const { data: pages } = await pagesRes.json() as { data: FbPage[] };

    if (!pages || pages.length === 0) {
      throw new Error(
        "No Facebook Pages found. Make sure you manage at least one Page."
      );
    }

    const db = getDb();
    const now = new Date().toISOString();

    // Upsert one account for the Facebook user (keyed by Facebook user ID)
    const existingAccount = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.providerId, input.providerId), eq(accounts.providerAccountId, me.id)))
      .get();

    let accountId: string;
    if (existingAccount) {
      await db.update(accounts).set({
        displayName: me.name,
        avatarUrl: me.picture?.data?.url ?? existingAccount.avatarUrl,
        accessToken: longToken,
        refreshToken: longToken,
        updatedAt: now,
      }).where(eq(accounts.id, existingAccount.id));
      accountId = existingAccount.id;
    } else {
      accountId = `acc_fb_${nanoid(8)}`;
      await db.insert(accounts).values({
        id: accountId,
        providerId: input.providerId,
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

    // Upsert one destination per page under this user account
    for (const page of pages) {
      const existingDest = await db
        .select({ id: publishDestinations.id })
        .from(publishDestinations)
        .where(and(
          eq(publishDestinations.socialAccountId, accountId),
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
          socialAccountId: accountId,
          name: page.name,
          type: DestinationType.facebook_page,
          externalId: page.id,
          accessToken: page.access_token,
          avatarUrl: pageAvatarUrl,
          createdAt: now,
        });
      }

      // Sync Instagram Business account connected to this page
      await syncInstagramForPage(accountId, page.id, page.access_token, now);
    }

    // Sync Threads profile (best-effort; silently skipped if threads_basic not granted)
    await syncThreadsForUser(accountId, longToken, now);
  }

  // Page access tokens don't expire, so refresh is a no-op.
  async refreshToken(_accountId: string): Promise<void> {
    // Page tokens are permanent; nothing to refresh.
  }

  async publishVideo(input: PublishVideoInput): Promise<PublishVideoResult> {
    const db = getDb();
    let pageId: string;
    let pageToken: string;

    if (input.destinationId) {
      // Preferred path: get page ID and token from the destination record
      const dest = await db
        .select()
        .from(publishDestinations)
        .where(eq(publishDestinations.id, input.destinationId))
        .get();
      if (!dest) throw new Error(`Destination ${input.destinationId} not found`);
      if (!dest.externalId) throw new Error(`Destination ${input.destinationId} has no page ID`);
      if (!dest.accessToken) throw new Error(`Destination ${input.destinationId} has no page token — run Sync to refresh`);
      pageId = dest.externalId;
      pageToken = dest.accessToken;
    } else {
      // Legacy fallback: account IS the page (old one-account-per-page model)
      const account = await getAccountRecord(input.accountId);
      if (!account.providerAccountId) throw new Error("Account has no page ID");
      if (!account.accessToken) throw new Error("Account has no page token");
      pageId = account.providerAccountId;
      pageToken = account.accessToken;
    }

    const { buffer, mime } = readVideoFile(input.videoPath);

    const formData = new FormData();
    formData.append("access_token", pageToken);
    formData.append("title", input.title ?? "");
    formData.append("description", input.caption ?? "");
    formData.append(
      "privacy",
      JSON.stringify({ value: PRIVACY_MAP[input.privacy ?? "private"] ?? "SELF" })
    );
    formData.append(
      "source",
      new Blob([buffer], { type: mime }),
      "video.mp4"
    );

    const uploadRes = await fetch(`${GRAPH_VIDEO}/${pageId}/videos`, {
      method: "POST",
      body: formData,
    });
    await checkHttpOk(uploadRes, "Facebook video upload");
    const { id: videoId } = await uploadRes.json();

    return {
      providerPostId: videoId,
      url: `https://www.facebook.com/${pageId}/videos/${videoId}/`,
    };
  }
}
