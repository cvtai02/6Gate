import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
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

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const YOUTUBE_DEFAULT_SCOPES =
  "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";

export class YouTubeAdapter implements SocialProviderAdapter {
  id = "youtube";
  name = "YouTube";

  async getAuthUrl(providerId: string): Promise<string> {
    const provider = await getProviderRecord(providerId);
    const scopes = provider.scopes
      ? provider.scopes.replace(/,/g, " ")
      : YOUTUBE_DEFAULT_SCOPES;

    const params = new URLSearchParams({
      client_id: provider.clientId!,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: scopes,
      access_type: "offline",
      state: providerId,
      prompt: "consent",
    });

    return `${AUTH_URL}?${params}`;
  }

  async handleOAuthCallback(input: {
    providerId: string;
    code: string;
    state?: string;
  }): Promise<void> {
    const provider = await getProviderRecord(input.providerId);

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        client_id: provider.clientId!,
        client_secret: provider.clientSecret!,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    await checkHttpOk(tokenRes, "YouTube token exchange");
    const tokens = await tokenRes.json();

    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const channelData = await channelRes.json();

    type YTChannel = {
      id: string;
      snippet: {
        title?: string;
        customUrl?: string;
        description?: string;
        publishedAt?: string;
        thumbnails?: {
          default?: { url?: string };
          medium?: { url?: string };
          high?: { url?: string };
        };
        country?: string;
      };
      statistics?: {
        subscriberCount?: string;
        videoCount?: string;
        viewCount?: string;
      };
    };

    const channels: YTChannel[] = channelData.items ?? [];

    const db = getDb();
    const now = new Date().toISOString();
    const accountId = `acc_yt_${nanoid(8)}`;
    const primary = channels[0];
    const displayName = primary?.snippet?.title ?? "YouTube Channel";
    const externalId = primary?.id ?? null;
    const thumbs = primary?.snippet?.thumbnails;
    const avatarUrl = thumbs?.high?.url ?? thumbs?.medium?.url ?? thumbs?.default?.url ?? null;

    await db.insert(accounts).values({
      id: accountId,
      providerId: input.providerId,
      providerAccountId: externalId,
      displayName,
      username: primary?.snippet?.customUrl ?? null,
      avatarUrl,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      scopes: tokens.scope ?? null,
      createdAt: now,
      updatedAt: now,
    });

    await createDestinationForAccount(accountId, "youtube", displayName, externalId);
  }

  async refreshToken(accountId: string): Promise<void> {
    const account = await getAccountRecord(accountId);
    if (!account.refreshToken) throw new Error("No refresh token stored");

    const provider = await getProviderRecord(account.providerId);

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: account.refreshToken,
        client_id: provider.clientId!,
        client_secret: provider.clientSecret!,
        grant_type: "refresh_token",
      }),
    });
    await checkHttpOk(res, "YouTube token refresh");
    const tokens = await res.json();

    const db = getDb();
    await db
      .update(accounts)
      .set({
        accessToken: tokens.access_token,
        expiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accounts.id, accountId));
  }

  async publishVideo(input: PublishVideoInput): Promise<PublishVideoResult> {
    await this.#ensureFreshToken(input.accountId);
    const account = await getAccountRecord(input.accountId);
    const accessToken = account.accessToken!;
    const { buffer, size, mime } = readVideoFile(input.videoPath);

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": mime,
          "X-Upload-Content-Length": size.toString(),
        },
        body: JSON.stringify({
          snippet: {
            title: input.title ?? "Untitled",
            description: input.caption ?? "",
          },
          status: { privacyStatus: input.privacy ?? "private" },
        }),
      }
    );
    await checkHttpOk(initRes, "YouTube upload init");

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube did not return an upload URL");

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mime,
        "Content-Length": size.toString(),
      },
      body: buffer,
    });

    if (uploadRes.status !== 200 && uploadRes.status !== 201) {
      const text = await uploadRes.text().catch(() => "");
      throw new Error(`YouTube upload failed (${uploadRes.status}): ${text}`);
    }

    const video = await uploadRes.json();
    return {
      providerPostId: video.id,
      url: `https://www.youtube.com/watch?v=${video.id}`,
    };
  }

  async getPostStatus(providerPostId: string): Promise<string> {
    return "completed";
  }

  async #ensureFreshToken(accountId: string) {
    const account = await getAccountRecord(accountId);
    if (
      account.expiresAt &&
      new Date(account.expiresAt) < new Date(Date.now() + 5 * 60 * 1000)
    ) {
      await this.refreshToken(accountId);
    }
  }
}
