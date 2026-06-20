import { nanoid } from "nanoid";
import { randomBytes, createHash } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, providers as providersTable } from "@/infrastructure/db/schema";
import type { SocialProviderAdapter, PublishVideoInput, PublishVideoResult } from "./types";
import CryptoJS from "crypto-js";
import {
  REDIRECT_URI,
  getProviderRecord,
  getAccountRecord,
  readVideoFile,
  checkHttpOk,
  createDestinationForAccount,
} from "./adapter-utils";
import { ProviderType, TIKTOK_SCOPES } from "@/core/enums";

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
export const TIKTOK_DEFAULT_SCOPES = TIKTOK_SCOPES;

function generateCodeVerifier(): string {
  return generateRandomString(43);
}

function generateRandomString(length: number): string {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function generateCodeChallenge(verifier: string): string {
  return CryptoJS.SHA256(verifier).toString(CryptoJS.enc.Hex);
}

const PRIVACY_MAP: Record<string, string> = {
  public: "PUBLIC_TO_EVERYONE",
  private: "SELF_ONLY",
  unlisted: "MUTUAL_FOLLOW_FRIENDS",
};

export class TikTokAdapter implements SocialProviderAdapter {
  id = ProviderType.tiktok;
  name = "TikTok";

  async getAuthUrl(providerId: string): Promise<string> {
    const provider = await getProviderRecord(providerId);
    const scopes = provider.scopes ?? TIKTOK_DEFAULT_SCOPES;

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Store verifier in DB â€" avoids any state-encoding / URL-transmission issues
    const db = getDb();
    await db.update(providersTable)
      .set({ pkceVerifier: codeVerifier })
      .where(eq(providersTable.id, providerId));
    console.log("[TikTok PKCE debug] stored verifier len:", codeVerifier.length, "challenge:", codeChallenge, "providerId:", providerId);

    // TikTok's OAuth screen expects literal commas in the scope param —
    // URL-encoded commas (%2C) cause it to silently drop scopes.
    const params = [
      `client_key=${encodeURIComponent(provider.clientId!)}`,
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
      `response_type=code`,
      `scope=${scopes}`,
      `state=${encodeURIComponent(providerId)}`,
      `code_challenge=${encodeURIComponent(codeChallenge)}`,
      `code_challenge_method=S256`,
    ].join("&");

    return `${AUTH_URL}?${params}`;
  }

  async handleOAuthCallback(input: {
    providerId: string;
    code: string;
    state?: string;
  }): Promise<void> {
    const provider = await getProviderRecord(input.providerId);

    // Read verifier from DB (stored during getAuthUrl), then clear it
    const db = getDb();
    const providerRow = await db.select({ pkceVerifier: providersTable.pkceVerifier })
      .from(providersTable)
      .where(eq(providersTable.id, input.providerId))
      .then((r) => r[0]);
    const codeVerifier = providerRow?.pkceVerifier ?? null;
    console.log("[TikTok PKCE debug] providerId:", input.providerId, "verifier len:", codeVerifier?.length, "first20:", codeVerifier?.slice(0, 20));
    if (!codeVerifier) throw new Error("PKCE verifier not found, please restart the OAuth flow");
    await db.update(providersTable)
      .set({ pkceVerifier: null })
      .where(eq(providersTable.id, input.providerId));

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

    if (!tokenRes.ok || tokens.error) {
      // TikTok has two error shapes:
      // OAuth layer: { "error": "invalid_request", "error_description": "..." }
      // API layer:   { "error": { "code": "...", "message": "..." } }
      const isOAuthError = typeof tokens.error === "string";
      const msg = isOAuthError ? (tokens.error_description ?? tokens.error) : (tokens.error?.message ?? `HTTP ${tokenRes.status}`);
      const code = isOAuthError ? tokens.error : (tokens.error?.code ?? String(tokenRes.status));
      throw new Error(`TikTok token exchange [${code}]: ${msg}`);
    }
    if (!data.access_token) {
      throw new Error(`TikTok token exchange returned no access_token: ${JSON.stringify(tokens)}`);
    }

    // Best-effort: user.info.basic may not be approved on the TikTok app yet.
    // If the call fails we still create the account using token-level data.
    type TikTokUser = {
      open_id?: string;
      union_id?: string;
      display_name?: string;
      username?: string;
      avatar_url?: string;
      avatar_url_100?: string;
      avatar_large_url?: string;
      bio_description?: string;
      profile_deep_link?: string;
      is_verified?: boolean;
    };
    let user: TikTokUser = {};
    try {
      const userRes = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name,avatar_url,avatar_url_100,avatar_large_url,username,bio_description,profile_deep_link,is_verified",
        {
          signal: AbortSignal.timeout(30_000),
          headers: { Authorization: `Bearer ${data.access_token}` },
        }
      );
      if (userRes.ok) {
        const userData = await userRes.json();
        if (!userData.error?.code || userData.error.code === "ok") {
          user = userData.data?.user ?? {};
        } else {
          console.warn("[TikTok] user info error:", userData.error.code, userData.error.message);
        }
      } else {
        const errText = await userRes.text().catch(() => `HTTP ${userRes.status}`);
        console.warn("[TikTok] user info fetch failed:", errText);
      }
    } catch (e) {
      console.warn("[TikTok] user info fetch threw:", e);
    }

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
    const avatarUrl = user.avatar_large_url ?? user.avatar_url ?? null;
    await createDestinationForAccount(accountId, ProviderType.tiktok, displayName, externalId, avatarUrl);
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

    // TikTok returns errors with HTTP 200 â€" must check the body
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
            title: input.caption ?? "",
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

    // The init/upload calls only get us a publish_id (e.g. "v_pub_file~v2-1.7644...") —
    // the real post_id only appears after TikTok finishes processing AND moderation
    // approves the post for public viewership. Poll until status is terminal.
    const { postId, sentToInbox } = await this.#pollPublishStatus(publish_id, accessToken);

    // When TikTok has no public post_id to give us — either because the video went to
    // the creator's drafts/inbox (unaudited-app flow), or PUBLISH_COMPLETE landed but
    // moderation hasn't surfaced a public URL yet — fall back to the publish_id as our
    // provider handle and skip the URL. The upload itself succeeded.
    if (sentToInbox || !postId) {
      const profileUrl = account.username
        ? `https://www.tiktok.com/@${account.username}`
        : undefined;
      return {
        providerPostId: postId ?? publish_id,
        url: profileUrl,
      };
    }

    return {
      providerPostId: postId,
      url: `https://www.tiktok.com/@${account.username ?? "user"}/video/${postId}`,
    };
  }

  /**
   * Poll TikTok /status/fetch until the upload reaches a terminal state.
   *
   * TikTok status values:
   *   PROCESSING_UPLOAD / PROCESSING_DOWNLOAD — keep polling
   *   PUBLISH_COMPLETE                         — done, post_id in publicaly_available_post_id[0]
   *   SEND_TO_USER_INBOX                       — sent to creator's drafts (unaudited app)
   *   FAILED                                   — give up, surface fail_reason
   */
  async #pollPublishStatus(
    publishId: string,
    accessToken: string
  ): Promise<{ postId: string | null; sentToInbox: boolean }> {
    const MAX_ATTEMPTS = 40;     // ~5 minutes at the cap
    const startedAt = Date.now();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // 3s, 5s, 8s, 12s, then 15s cap. Total ≤ ~5min.
      const waitMs = Math.min(15_000, 3_000 + attempt * 2_000);
      await new Promise((r) => setTimeout(r, waitMs));

      const res = await fetch(
        "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
        {
          method: "POST",
          signal: AbortSignal.timeout(30_000),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
          },
          body: JSON.stringify({ publish_id: publishId }),
        }
      );

      // Network/HTTP-level failures are retried by the outer loop until MAX_ATTEMPTS.
      if (!res.ok) continue;

      const body = await res.json().catch(() => ({}));
      if (body.error?.code && body.error.code !== "ok") {
        // API-layer error — keep polling unless it's clearly fatal.
        continue;
      }

      const data = body.data ?? {};
      const status: string = data.status ?? "";

      if (status === "PUBLISH_COMPLETE") {
        // TikTok ships this field with a typo in production; accept both spellings.
        const ids: string[] =
          data.publicaly_available_post_id ?? data.publicly_available_post_id ?? [];
        return { postId: ids[0] ?? null, sentToInbox: false };
      }

      if (status === "SEND_TO_USER_INBOX") {
        return { postId: null, sentToInbox: true };
      }

      if (status === "FAILED") {
        const reason = data.fail_reason ?? "unknown";
        throw new Error(`TikTok publish failed: ${reason}`);
      }

      // PROCESSING_UPLOAD / PROCESSING_DOWNLOAD / unknown → loop
    }

    const elapsedMin = ((Date.now() - startedAt) / 60_000).toFixed(1);
    throw new Error(
      `TikTok did not finish processing within ${elapsedMin}min. The video may still publish — check your TikTok account. publish_id=${publishId}`
    );
  }

  async #ensureFreshToken(accountId: string) {
    const account = await getAccountRecord(accountId);
    if (!account.refreshToken) return; // no refresh token â€" let upload attempt and fail with clear error if expired
    if (
      account.expiresAt &&
      new Date(account.expiresAt) < new Date(Date.now() + 10 * 60 * 1000)
    ) {
      await this.refreshToken(accountId);
    }
  }
}