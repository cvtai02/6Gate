import { nanoid } from "nanoid";
import fs from "fs";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts } from "@/infrastructure/db/schema";
import type { SocialProviderAdapter, PublishVideoInput, PublishVideoResult } from "./types";
import {
  REDIRECT_URI,
  getProviderRecord,
  getAccountRecord,
  getMimeType,
  checkHttpOk,
  createDestinationForAccount,
} from "./adapter-utils";
import { ProviderType } from "@/core/enums";
import { appendLog } from "@/infrastructure/jobs/log-service";

/** YouTube requires chunk sizes to be a multiple of 256 KB except for the final chunk. */
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB — Google's recommended minimum

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const YOUTUBE_DEFAULT_SCOPES =
  "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";

export class YouTubeAdapter implements SocialProviderAdapter {
  id = ProviderType.youtube;
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

    await createDestinationForAccount(accountId, ProviderType.youtube, displayName, externalId, avatarUrl);
  }

  async refreshToken(accountId: string): Promise<void> {
    const account = await getAccountRecord(accountId);
    if (!account.refreshToken) throw new Error("No refresh token stored");

    const provider = await getProviderRecord(account.providerId);

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
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

    const log = (msg: string) => this.#log(input.jobId, msg);
    const mime = getMimeType(input.videoPath);
    const size = fs.statSync(input.videoPath).size;
    await log(`YouTube upload — ${(size / 1024 / 1024).toFixed(1)}MB`);

    // ── Phase 1: open a resumable upload session ──────────────────────────────
    await log("Phase 1/2: requesting resumable upload session");
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        signal: AbortSignal.timeout(60_000),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mime,
          "X-Upload-Content-Length": String(size),
        },
        body: JSON.stringify({
          snippet: {
            title: input.title ?? "Untitled",
            description: input.caption ?? "",
          },
          status: {
            privacyStatus: input.privacy ?? "private",
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    );
    await checkHttpOk(initRes, "YouTube upload init");

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube init returned no Location header");
    await log("Got resumable session URL");

    // ── Phase 2: chunked PUT until Google returns the final video resource ────
    // Each chunk MUST set Content-Length and Content-Range or undici falls back
    // to chunked transfer encoding, which Google rejects/hangs on. This is the
    // single most common cause of "stuck on Uploading".
    await log("Phase 2/2: uploading chunks");
    const video = await this.#uploadChunks(uploadUrl, input.videoPath, size, mime, log);

    return {
      providerPostId: video.id,
      url: `https://www.youtube.com/watch?v=${video.id}`,
    };
  }

  /**
   * PUT the file in 8 MB chunks. Track the cursor from Google's `Range` header
   * (which is authoritative — packets can drop) instead of just incrementing
   * by the chunk we just sent.
   */
  async #uploadChunks(
    uploadUrl: string,
    videoPath: string,
    size: number,
    mime: string,
    log: (msg: string) => Promise<void>
  ): Promise<{ id: string; [k: string]: unknown }> {
    const fd = fs.openSync(videoPath, "r");
    let cursor = 0;

    try {
      while (cursor < size) {
        const end = Math.min(cursor + CHUNK_SIZE, size) - 1; // inclusive
        const chunkSize = end - cursor + 1;
        const buf = Buffer.alloc(chunkSize);
        fs.readSync(fd, buf, 0, chunkSize, cursor);

        const res = await fetch(uploadUrl, {
          method: "PUT",
          signal: AbortSignal.timeout(5 * 60_000),
          headers: {
            "Content-Type": mime,
            "Content-Length": String(chunkSize),
            "Content-Range": `bytes ${cursor}-${end}/${size}`,
          },
          body: buf,
        });

        if (res.status === 200 || res.status === 201) {
          // Final chunk — body is the video resource.
          const video = await res.json();
          await log(`Uploaded ${size.toLocaleString()}/${size.toLocaleString()} bytes (100%)`);
          return video;
        }

        if (res.status === 308) {
          // Resume Incomplete. The Range header is authoritative — "bytes=0-X"
          // means Google has received bytes 0..X, so the next byte to send is X+1.
          // If the header is missing (rare), fall back to the end of what we sent.
          const rangeHeader = res.headers.get("range");
          const match = rangeHeader?.match(/bytes=\d+-(\d+)/);
          cursor = match ? Number(match[1]) + 1 : end + 1;

          const pct = ((cursor / size) * 100).toFixed(0);
          await log(`Uploaded ${cursor.toLocaleString()}/${size.toLocaleString()} bytes (${pct}%)`);
          continue;
        }

        // Permanent error (4xx / non-308 5xx) — surface the body and bail.
        const text = await res.text().catch(() => "");
        throw new Error(`YouTube chunk upload failed (${res.status}): ${text.slice(0, 500)}`);
      }

      throw new Error("YouTube upload loop exited without a final response");
    } finally {
      fs.closeSync(fd);
    }
  }

  async #log(jobId: string | undefined, msg: string): Promise<void> {
    if (!jobId) return;
    try {
      await appendLog(jobId, "info", msg);
    } catch {
      /* logging is best-effort; never let it derail the upload */
    }
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
