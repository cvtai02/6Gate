import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { accounts } from "@/server/db/schema";
import type { SocialProviderAdapter, PublishVideoInput, PublishVideoResult } from "./types";
import {
  REDIRECT_URI,
  getProviderRecord,
  getAccountRecord,
  readVideoFile,
  checkHttpOk,
  createDestinationForAccount,
} from "./adapter-utils";

const GRAPH = "https://graph.facebook.com/v21.0";
const GRAPH_VIDEO = "https://graph-video.facebook.com/v21.0";
export const FACEBOOK_DEFAULT_SCOPES =
  "pages_manage_posts,pages_read_engagement,pages_show_list,publish_video";

const PRIVACY_MAP: Record<string, string> = {
  public: "EVERYONE",
  private: "SELF",
  unlisted: "ALL_FRIENDS",
};

export class FacebookAdapter implements SocialProviderAdapter {
  id = "facebook";
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

    // Get pages managed by this user
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?access_token=${longToken}`
    );
    await checkHttpOk(pagesRes, "Facebook get pages");
    const { data: pages } = await pagesRes.json();

    if (!pages || pages.length === 0) {
      throw new Error(
        "No Facebook Pages found. Make sure you manage at least one Page."
      );
    }

    const db = getDb();
    const now = new Date().toISOString();

    for (const page of pages) {
      const accountId = `acc_fb_${nanoid(8)}`;
      await db.insert(accounts).values({
        id: accountId,
        providerId: input.providerId,
        providerAccountId: page.id,
        displayName: page.name,
        username: null,
        avatarUrl: null,
        accessToken: page.access_token,
        refreshToken: longToken,
        expiresAt: null,
        scopes: page.perms?.join(",") ?? null,
        createdAt: now,
        updatedAt: now,
      });
      await createDestinationForAccount(accountId, "facebook", page.name, page.id);
    }
  }

  // Page access tokens don't expire, so refresh is a no-op.
  // Calling this will extend the user token if stored.
  async refreshToken(accountId: string): Promise<void> {
    // Page tokens are permanent; nothing to refresh.
  }

  async publishVideo(input: PublishVideoInput): Promise<PublishVideoResult> {
    const account = await getAccountRecord(input.accountId);
    const pageId = account.providerAccountId!;
    const pageToken = account.accessToken!;
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
