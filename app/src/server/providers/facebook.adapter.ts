import { nanoid } from "nanoid";
import fs from "fs";
import { getDb } from "@/server/db";
import { accounts, destinations } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { SocialProviderAdapter, PublishVideoInput, PublishVideoResult } from "./types";
import {
  REDIRECT_URI,
  getProviderRecord,
  getAccountRecord,
  checkHttpOk,
} from "./adapter-utils";
import { ProviderType, DestinationType, PublishStatus } from "@/lib/enums";
import { syncInstagramForPage, syncThreadsForUser } from "./meta-ig-threads";
import { appendLog } from "@/server/jobs/log-service";
import { getJob } from "@/server/jobs/job-service";

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
      .then((r) => r[0]);

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
        .select({ id: destinations.id })
        .from(destinations)
        .where(and(
          eq(destinations.socialAccountId, accountId),
          eq(destinations.externalId, page.id)
        ))
        .then((r) => r[0]);

      const pageAvatarUrl = page.picture?.data?.url ?? null;
      if (existingDest) {
        await db.update(destinations).set({
          name: page.name,
          accessToken: page.access_token,
          avatarUrl: pageAvatarUrl,
        }).where(eq(destinations.id, existingDest.id));
      } else {
        await db.insert(destinations).values({
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
      const dest = await db
        .select()
        .from(destinations)
        .where(eq(destinations.id, input.destinationId))
        .then((r) => r[0]);
      if (!dest) throw new Error(`Destination ${input.destinationId} not found`);
      if (!dest.externalId) throw new Error(`Destination ${input.destinationId} has no page ID`);
      if (!dest.accessToken) throw new Error(`Destination ${input.destinationId} has no page token — run Sync to refresh`);
      pageId = dest.externalId;
      pageToken = dest.accessToken;
    } else {
      const account = await getAccountRecord(input.accountId);
      if (!account.providerAccountId) throw new Error("Account has no page ID");
      if (!account.accessToken) throw new Error("Account has no page token");
      pageId = account.providerAccountId;
      pageToken = account.accessToken;
    }

    // Branch by content type — Reel uses /video_reels with the rupload URL flow,
    // normal Page video uses /videos with start/transfer/finish phases.
    if ((input.contentType ?? "Video") === "Reel") {
      return this.#publishReel(input, pageId, pageToken);
    }
    return this.#publishPageVideo(input, pageId, pageToken);
  }

  /**
   * Facebook Page video — chunked upload via /videos with upload_phase=start/transfer/finish,
   * then poll /{video-id}?fields=status until processing succeeds. Per the resilient-job plan.
   */
  async #publishPageVideo(
    input: PublishVideoInput,
    pageId: string,
    pageToken: string
  ): Promise<PublishVideoResult> {
    const log = (msg: string) => this.#log(input.jobId, msg);
    const fileSize = fs.statSync(input.videoPath).size;
    await log(`Page video upload — ${(fileSize / 1024 / 1024).toFixed(1)}MB`);

    // Phase 1: start — Facebook tells us the chunk boundaries.
    await this.#throwIfCancelled(input.jobId);
    await log("Phase 1/4: requesting upload session");
    const startBody = new URLSearchParams({
      upload_phase: "start",
      file_size: String(fileSize),
      access_token: pageToken,
    });
    const startRes = await fetch(`${GRAPH_VIDEO}/${pageId}/videos`, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: startBody,
    });
    if (!startRes.ok) throw await readFbError(startRes, "start phase");
    await this.#throwIfCancelled(input.jobId);
    const startData = await startRes.json();
    const videoId: string = startData.video_id;
    const uploadSessionId: string = startData.upload_session_id;
    let curStart = Number(startData.start_offset);
    let curEnd = Number(startData.end_offset);
    await log(`Got video_id=${videoId}, session=${uploadSessionId}`);

    // Phase 2: transfer chunks until start_offset == end_offset.
    await this.#throwIfCancelled(input.jobId);
    await log(`Phase 2/4: transferring chunks`);
    const fd = fs.openSync(input.videoPath, "r");
    try {
      while (curStart < curEnd) {
        await this.#throwIfCancelled(input.jobId);
        const chunkSize = curEnd - curStart;
        const buf = Buffer.alloc(chunkSize);
        fs.readSync(fd, buf, 0, chunkSize, curStart);

        const transferForm = new FormData();
        transferForm.append("upload_phase", "transfer");
        transferForm.append("upload_session_id", uploadSessionId);
        transferForm.append("start_offset", String(curStart));
        transferForm.append("access_token", pageToken);
        transferForm.append(
          "video_file_chunk",
          new Blob([buf], { type: "application/octet-stream" }),
          "chunk"
        );

        const transferRes = await fetch(`${GRAPH_VIDEO}/${pageId}/videos`, {
          method: "POST",
          signal: AbortSignal.timeout(300_000),
          body: transferForm,
        });
        if (!transferRes.ok) throw await readFbError(transferRes, "transfer chunk");
        await this.#throwIfCancelled(input.jobId);

        const transferData = await transferRes.json();
        curStart = Number(transferData.start_offset);
        curEnd = Number(transferData.end_offset);

        const pct = ((curStart / fileSize) * 100).toFixed(0);
        await log(`Uploaded ${curStart.toLocaleString()}/${fileSize.toLocaleString()} bytes (${pct}%)`);
      }
    } finally {
      fs.closeSync(fd);
    }

    // Phase 3: finish — commit the upload with metadata.
    await this.#throwIfCancelled(input.jobId);
    await log("Phase 3/4: finishing upload");
    const finishBody = new URLSearchParams({
      upload_phase: "finish",
      upload_session_id: uploadSessionId,
      access_token: pageToken,
    });
    if (input.title) finishBody.append("title", input.title);
    if (input.caption) finishBody.append("description", input.caption);
    finishBody.append(
      "privacy",
      JSON.stringify({ value: PRIVACY_MAP[input.privacy ?? "private"] ?? "SELF" })
    );

    const finishRes = await fetch(`${GRAPH_VIDEO}/${pageId}/videos`, {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: finishBody,
    });
    if (!finishRes.ok) throw await readFbError(finishRes, "finish phase");
    await this.#throwIfCancelled(input.jobId);

    // Phase 4: poll processing status.
    await log("Phase 4/4: waiting for Facebook to finish processing");
    await this.#pollVideoStatus(videoId, pageToken, input.jobId);

    return {
      providerPostId: videoId,
      url: `https://www.facebook.com/${pageId}/videos/${videoId}/`,
    };
  }

  /**
   * Facebook Page Reel — start /video_reels (gets upload_url + video_id) → POST binary
   * to upload_url → finish with video_state=PUBLISHED → poll status.
   */
  async #publishReel(
    input: PublishVideoInput,
    pageId: string,
    pageToken: string
  ): Promise<PublishVideoResult> {
    const log = (msg: string) => this.#log(input.jobId, msg);
    const fileSize = fs.statSync(input.videoPath).size;
    await log(`Reel upload — ${(fileSize / 1024 / 1024).toFixed(1)}MB`);

    // Phase 1: start
    await this.#throwIfCancelled(input.jobId);
    await log("Phase 1/4: starting Reel session");
    const startRes = await fetch(
      `${GRAPH}/${pageId}/video_reels?upload_phase=start&access_token=${encodeURIComponent(pageToken)}`,
      { method: "POST", signal: AbortSignal.timeout(30_000) }
    );
    if (!startRes.ok) throw await readFbError(startRes, "Reel start");
    await this.#throwIfCancelled(input.jobId);
    const startData = await startRes.json();
    const videoId: string = startData.video_id;
    const uploadUrl: string = startData.upload_url;
    await log(`Got video_id=${videoId}`);

    // Phase 2: upload binary to rupload URL — single POST with OAuth + offset + file_size headers.
    await this.#throwIfCancelled(input.jobId);
    await log("Phase 2/4: uploading binary to rupload URL");
    const videoBuf = fs.readFileSync(input.videoPath);
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      signal: AbortSignal.timeout(10 * 60_000),
      headers: {
        Authorization: `OAuth ${pageToken}`,
        offset: "0",
        file_size: String(fileSize),
      },
      body: videoBuf,
    });
    if (!uploadRes.ok) throw await readFbError(uploadRes, "Reel binary upload");
    await this.#throwIfCancelled(input.jobId);
    await log("Binary upload complete");

    // Phase 3: finish — video_state=PUBLISHED unless privacy=private (then DRAFT).
    await this.#throwIfCancelled(input.jobId);
    await log("Phase 3/4: finishing Reel");
    const videoState = input.privacy === "private" ? "DRAFT" : "PUBLISHED";
    const finishParams = new URLSearchParams({
      video_id: videoId,
      upload_phase: "finish",
      video_state: videoState,
      access_token: pageToken,
    });
    if (input.caption) finishParams.append("description", input.caption);

    const finishRes = await fetch(
      `${GRAPH}/${pageId}/video_reels?${finishParams}`,
      { method: "POST", signal: AbortSignal.timeout(60_000) }
    );
    if (!finishRes.ok) throw await readFbError(finishRes, "Reel finish");
    await this.#throwIfCancelled(input.jobId);

    // Phase 4: poll status
    await log("Phase 4/4: waiting for Facebook to finish processing");
    await this.#pollVideoStatus(videoId, pageToken, input.jobId);

    return {
      providerPostId: videoId,
      url: `https://www.facebook.com/reel/${videoId}`,
    };
  }

  /**
   * Poll GET /{video-id}?fields=status until video_status reaches "ready" or "error".
   * Returns silently on timeout — the upload itself succeeded, processing just takes longer.
   */
  async #pollVideoStatus(
    videoId: string,
    accessToken: string,
    jobId: string | undefined
  ): Promise<void> {
    const MAX_ATTEMPTS = 40; // ~10 min at the cap
    let lastReported = "";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await this.#throwIfCancelled(jobId);
      // 5s, 7s, 9s, ... cap at 20s
      const waitMs = Math.min(20_000, 5_000 + i * 2_000);
      await new Promise((r) => setTimeout(r, waitMs));
      await this.#throwIfCancelled(jobId);

      const res = await fetch(
        `${GRAPH}/${videoId}?fields=status&access_token=${encodeURIComponent(accessToken)}`,
        { signal: AbortSignal.timeout(30_000) }
      );
      await this.#throwIfCancelled(jobId);
      if (!res.ok) continue; // transient — keep polling

      const body = await res.json().catch(() => ({}));
      const vs: string | undefined = body.status?.video_status;
      const ps: string | undefined = body.status?.processing_phase?.status;

      if (vs && vs !== lastReported) {
        await this.#log(jobId, `Facebook status: ${vs}${ps ? ` (${ps})` : ""}`);
        lastReported = vs;
      }

      if (vs === "ready") return;
      if (vs === "error") {
        throw new Error(
          `Facebook video processing failed: ${JSON.stringify(body.status)}`
        );
      }
      // "processing" / unknown → loop
    }

    await this.#log(
      jobId,
      "Facebook processing did not complete within poll window; the video may still appear shortly"
    );
  }

  async #log(jobId: string | undefined, msg: string): Promise<void> {
    if (!jobId) return;
    try {
      await appendLog(jobId, "info", msg);
    } catch {
      /* logging is best-effort; never let it derail the upload */
    }
  }

  async #throwIfCancelled(jobId: string | undefined): Promise<void> {
    if (!jobId) return;
    const job = await getJob(jobId);
    if (job?.status === PublishStatus.Cancelled) {
      throw new Error("Job cancelled");
    }
  }
}

/** Pull a useful error message from a Meta Graph API error response. */
async function readFbError(res: Response, phase: string): Promise<Error> {
  const text = await res.text().catch(() => `HTTP ${res.status}`);
  try {
    const json = JSON.parse(text);
    const e = json.error;
    if (e) {
      const parts = [
        `Facebook ${phase} failed: ${e.message}`,
        e.code !== undefined ? `code=${e.code}` : null,
        e.error_subcode !== undefined ? `subcode=${e.error_subcode}` : null,
        e.fbtrace_id ? `trace=${e.fbtrace_id}` : null,
      ].filter(Boolean);
      return new Error(parts.join(" "));
    }
  } catch {
    /* not JSON — fall through */
  }
  return new Error(`Facebook ${phase} failed (${res.status}): ${text.slice(0, 500)}`);
}
