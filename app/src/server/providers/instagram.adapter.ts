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
const RUPLOAD = "https://rupload.facebook.com";
export const INSTAGRAM_DEFAULT_SCOPES =
  "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement";

export class InstagramAdapter implements SocialProviderAdapter {
  id = "instagram";
  name = "Instagram";

  async getAuthUrl(providerId: string): Promise<string> {
    const provider = await getProviderRecord(providerId);
    const scopes = provider.scopes ?? INSTAGRAM_DEFAULT_SCOPES;

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

    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          client_id: provider.clientId!,
          client_secret: provider.clientSecret!,
          redirect_uri: REDIRECT_URI,
          code: input.code,
        })
    );
    await checkHttpOk(tokenRes, "Instagram (Facebook) token exchange");
    const { access_token: shortToken } = await tokenRes.json();

    // Extend to long-lived token
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: provider.clientId!,
          client_secret: provider.clientSecret!,
          fb_exchange_token: shortToken,
        })
    );
    await checkHttpOk(longRes, "Instagram long-lived token exchange");
    const { access_token: longToken } = await longRes.json();

    // Get pages and their linked Instagram accounts
    const pagesRes = await fetch(`${GRAPH}/me/accounts?access_token=${longToken}`);
    await checkHttpOk(pagesRes, "Instagram get pages");
    const { data: pages } = await pagesRes.json();

    if (!pages || pages.length === 0) {
      throw new Error(
        "No Facebook Pages found. Instagram requires a connected Facebook Page with a Professional account."
      );
    }

    const db = getDb();
    const now = new Date().toISOString();
    let connected = 0;

    for (const page of pages) {
      // Find IG business account linked to this page
      const igRes = await fetch(
        `${GRAPH}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      const igData = await igRes.json();
      const igId = igData.instagram_business_account?.id;
      if (!igId) continue;

      // Get IG account details
      const igInfoRes = await fetch(
        `${GRAPH}/${igId}?fields=username,name,profile_picture_url&access_token=${page.access_token}`
      );
      const igInfo = await igInfoRes.json();

      const accountId = `acc_ig_${nanoid(8)}`;
      const displayName = igInfo.name ?? igInfo.username ?? igId;
      await db.insert(accounts).values({
        id: accountId,
        providerId: input.providerId,
        providerAccountId: igId,
        displayName,
        username: igInfo.username ?? null,
        avatarUrl: igInfo.profile_picture_url ?? null,
        accessToken: page.access_token,
        refreshToken: longToken,
        expiresAt: null,
        scopes: INSTAGRAM_DEFAULT_SCOPES,
        createdAt: now,
        updatedAt: now,
      });
      await createDestinationForAccount(accountId, "instagram", displayName, igId);
      connected++;
    }

    if (connected === 0) {
      throw new Error(
        "No Instagram Professional accounts found linked to your Pages. " +
          "Convert your Instagram account to a Professional account and connect it to a Facebook Page."
      );
    }
  }

  async refreshToken(accountId: string): Promise<void> {
    // Page tokens don't expire; nothing to refresh.
  }

  async publishVideo(input: PublishVideoInput): Promise<PublishVideoResult> {
    const account = await getAccountRecord(input.accountId);
    const igUserId = account.providerAccountId!;
    const pageToken = account.accessToken!;
    const { buffer, size } = readVideoFile(input.videoPath);

    // Step 1: Create resumable upload session (media container)
    const createRes = await fetch(`${GRAPH}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "REELS",
        upload_type: "resumable",
        caption: input.caption ?? "",
        access_token: pageToken,
      }),
    });
    await checkHttpOk(createRes, "Instagram create media container");
    const { id: creationId, uri: uploadUri } = await createRes.json();

    if (!uploadUri) {
      throw new Error("Instagram did not return an upload URI");
    }

    // Step 2: Upload video (single chunk)
    const uploadRes = await fetch(uploadUri, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${pageToken}`,
        offset: "0",
        file_size: size.toString(),
        "Content-Type": "video/mp4",
      },
      body: buffer,
    });
    await checkHttpOk(uploadRes, "Instagram video upload");

    // Step 3: Publish
    const publishRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: pageToken,
      }),
    });
    await checkHttpOk(publishRes, "Instagram media publish");
    const { id: mediaId } = await publishRes.json();

    return {
      providerPostId: mediaId,
      url: `https://www.instagram.com/p/${mediaId}/`,
    };
  }
}
