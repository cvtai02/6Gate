import { nanoid } from "nanoid";
import { randomBytes, createHash } from "crypto";
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

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
export const TIKTOK_DEFAULT_SCOPES = "user.info.basic,user.info.profile,video.upload,video.publish";

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// Encode providerId + verifier into state so it survives server restarts/hot-reloads.
// Format: base64url(providerId) + "." + base64url(verifier)
function encodeState(providerId: string, verifier: string): string {
  return Buffer.from(providerId).toString("base64url") + "." + Buffer.from(verifier).toString("base64url");
}

function decodeState(state: string): { providerId: string; verifier: string } | null {
  const dot = state.indexOf(".");
  if (dot === -1) return null;
  try {
    return {
      providerId: Buffer.from(state.slice(0, dot), "base64url").toString(),
      verifier: Buffer.from(state.slice(dot + 1), "base64url").toString(),
    };
  } catch {
    return null;
  }
}

const PRIVACY_MAP: Record<string, string> = {
  public: "PUBLIC_TO_EVERYONE",
  private: "SELF_ONLY",
  unlisted: "MUTUAL_FOLLOW_FRIENDS",
};

export class TikTokAdapter implements SocialProviderAdapter {
  id = "tiktok";
  name = "TikTok";

  async getAuthUrl(providerId: string): Promise<string> {
    const provider = await getProviderRecord(providerId);
    const scopes = provider.scopes ?? TIKTOK_DEFAULT_SCOPES;

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
      client_key: provider.clientId!,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: scopes,
      state: encodeState(providerId, codeVerifier),
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return `${AUTH_URL}?${params}`;
  }

  async handleOAuthCallback(input: {
    providerId: string;
    code: string;
    state?: string;
  }): Promise<void> {
    const provider = await getProviderRecord(input.providerId);

    const decoded = input.state ? decodeState(input.state) : null;
    const codeVerifier = decoded?.verifier ?? null;
    if (!codeVerifier) throw new Error("PKCE state missing or invalid — please restart the OAuth flow");

    const tokenBody: Record<string, string> = {
      client_key: provider.clientId!,
      client_secret: provider.clientSecret!,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    };

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(tokenBody),
    });
    const tokens = await tokenRes.json().catch(() => ({}));
    const data = tokens.data ?? tokens;

    if (!tokenRes.ok || (tokens.error?.code && tokens.error.code !== "ok")) {
      const msg = tokens.error?.message ?? `HTTP ${tokenRes.status}`;
      const code = tokens.error?.code ?? String(tokenRes.status);
      throw new Error(`TikTok token exchange [${code}]: ${msg}`);
    }
    if (!data.access_token) {
      throw new Error(`TikTok token exchange returned no access_token: ${JSON.stringify(tokens)}`);
    }

    const userRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_large_url,avatar_url,username,profile_deep_link",
      { headers: { Authorization: `Bearer ${data.access_token}` } }
    );
    const userData = await userRes.json();
    const user = userData.data?.user ?? {};

    const db = getDb();
    const now = new Date().toISOString();
    const accountId = `acc_tt_${nanoid(8)}`;
    const displayName = user.display_name ?? "TikTok User";
    const externalId = user.open_id ?? data.open_id ?? null;
    await db.insert(accounts).values({
      id: accountId,
      providerId: input.providerId,
      providerAccountId: externalId,
      displayName,
      username: user.username ?? null,
      avatarUrl: user.avatar_large_url ?? user.avatar_url ?? null,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
      scopes: data.scope ?? null,
      createdAt: now,
      updatedAt: now,
    });
    await createDestinationForAccount(accountId, "tiktok", displayName, externalId);
  }

  async refreshToken(accountId: string): Promise<void> {
    const account = await getAccountRecord(accountId);
    if (!account.refreshToken) throw new Error("No refresh token stored");

    const provider = await getProviderRecord(account.providerId);

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: provider.clientId!,
        client_secret: provider.clientSecret!,
        grant_type: "refresh_token",
        refresh_token: account.refreshToken,
      }),
    });

    const json = await res.json().catch(() => ({}));
    const data = json.data ?? json;

    // TikTok returns errors with HTTP 200 — must check the body
    if (!res.ok || (json.error?.code && json.error.code !== "ok")) {
      const msg = json.error?.message ?? `HTTP ${res.status}`;
      const code = json.error?.code ?? String(res.status);
      throw new Error(`TikTok token refresh [${code}]: ${msg}. Reconnect this TikTok account.`);
    }

    if (!data.access_token) {
      throw new Error(`TikTok token refresh returned no access_token: ${JSON.stringify(json)}`);
    }

    const db = getDb();
    await db
      .update(accounts)
      .set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? account.refreshToken,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000).toISOString()
          : null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accounts.id, accountId));
  }

  async publishVideo(input: PublishVideoInput): Promise<PublishVideoResult> {
    await this.#ensureFreshToken(input.accountId);
    return this.#doUpload(input);
  }

  async #doUpload(input: PublishVideoInput, retried = false): Promise<PublishVideoResult> {
    const account = await getAccountRecord(input.accountId);
    const accessToken = account.accessToken!;
    const { buffer, size } = readVideoFile(input.videoPath);

    const initRes = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          post_info: {
            title: input.title ?? "",
            privacy_level: PRIVACY_MAP[input.privacy ?? "private"] ?? "SELF_ONLY",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: "FILE_UPLOAD",
            video_size: size,
            chunk_size: size,
            total_chunk_count: 1,
          },
        }),
      }
    );

    // Token-invalid errors come back as HTTP 4xx; retry once after a forced refresh
    if (!initRes.ok) {
      const body = await initRes.text().catch(() => `HTTP ${initRes.status}`);
      const isTokenError =
        initRes.status === 401 ||
        body.includes("access_token_invalid") ||
        body.includes("token_not_found");
      if (isTokenError && !retried) {
        const acct = await getAccountRecord(input.accountId);
        if (!acct.refreshToken) {
          throw new Error("TikTok access token expired and no refresh token is stored. Disconnect and reconnect this TikTok account.");
        }
        await this.refreshToken(input.accountId);
        return this.#doUpload(input, true);
      }
      throw new Error(`TikTok upload init: ${body}`);
    }

    const initData = await initRes.json();
    if (initData.error?.code && initData.error.code !== "ok") {
      throw new Error(`TikTok upload init error: ${initData.error.message}`);
    }

    const { publish_id, upload_url } = initData.data;

    const chunkRes = await fetch(upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Range": `bytes 0-${size - 1}/${size}`,
        "Content-Length": size.toString(),
      },
      body: buffer,
    });

    if (!chunkRes.ok && chunkRes.status !== 206) {
      const text = await chunkRes.text().catch(() => "");
      throw new Error(`TikTok chunk upload failed (${chunkRes.status}): ${text}`);
    }

    return {
      providerPostId: publish_id,
      url: `https://www.tiktok.com/@${account.username ?? "user"}/video/${publish_id}`,
    };
  }

  async #ensureFreshToken(accountId: string) {
    const account = await getAccountRecord(accountId);
    if (!account.refreshToken) return; // no refresh token — let upload attempt and fail with clear error if expired
    if (
      account.expiresAt &&
      new Date(account.expiresAt) < new Date(Date.now() + 10 * 60 * 1000)
    ) {
      await this.refreshToken(accountId);
    }
  }
}
