import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, destinations } from "@/infrastructure/db/schema";
import { ProviderType, PublishStatus } from "@/core/enums";
import { appendLog } from "@/infrastructure/jobs/log-service";
import { getJob } from "@/infrastructure/jobs/job-service";
import { getMimeType, getProviderRecord } from "./adapter-utils";
import type { PublishVideoInput, PublishVideoResult, SocialProviderAdapter } from "./types";
import { readZernioJson, zernioFetch, zernioPlatformForDestination } from "./zernio-service";

export class ZernioAdapter implements SocialProviderAdapter {
  id = ProviderType.zernio;
  name = "Zernio";

  async getAuthUrl(): Promise<string> {
    throw new Error("Zernio uses API-key sync. Configure an API key, then click Sync Accounts.");
  }

  async handleOAuthCallback(): Promise<void> {
    throw new Error("Zernio uses API-key sync and does not use this OAuth callback.");
  }

  async refreshToken(): Promise<void> {
    return;
  }

  async publishVideo(input: PublishVideoInput): Promise<PublishVideoResult> {
    const db = getDb();
    const account = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).then((r) => r[0]);
    if (!account) throw new Error(`Account ${input.accountId} not found`);

    const provider = await getProviderRecord(account.providerId);
    const destination = input.destinationId
      ? await db.select().from(destinations).where(eq(destinations.id, input.destinationId)).then((r) => r[0])
      : null;

    const zernioAccountId = destination?.externalId ?? account.providerAccountId;
    if (!zernioAccountId) throw new Error("Zernio destination is missing an account ID. Sync Zernio accounts first.");

    const platform = zernioPlatformForDestination(destination?.type) ?? this.#platformFromAccount(account.scopes);
    if (!platform) throw new Error("Unsupported Zernio destination. Supported: TikTok, Facebook Page, Instagram, YouTube.");

    const log = (msg: string) => this.#log(input.jobId, msg);
    const stat = fs.statSync(input.videoPath);
    const mime = getMimeType(input.videoPath);
    const fileName = path.basename(input.videoPath);

    await log(`Zernio upload - ${(stat.size / 1024 / 1024).toFixed(1)}MB`);
    await this.#throwIfCancelled(input.jobId);

    await log("Phase 1/3: requesting Zernio media upload URL");
    const credentials = {
      name: account.displayName ?? provider.name,
      clientId: provider.clientId,
      apiKey: account.accessToken ?? provider.clientSecret,
    };
    const presignRes = await zernioFetch(credentials, "/media/presign", {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ fileName, fileType: mime }),
    });
    const presign = await readZernioJson<{ uploadUrl?: string; publicUrl?: string }>(
      presignRes,
      "Zernio media presign"
    );
    if (!presign.uploadUrl || !presign.publicUrl) {
      throw new Error("Zernio media presign response did not include uploadUrl/publicUrl");
    }

    await this.#throwIfCancelled(input.jobId);
    await log("Phase 2/3: uploading video to Zernio storage");
    const uploadRes = await fetch(presign.uploadUrl, {
      method: "PUT",
      signal: AbortSignal.timeout(30 * 60_000),
      headers: {
        "Content-Type": mime,
        "Content-Length": String(stat.size),
      },
      body: fs.createReadStream(input.videoPath) as unknown as BodyInit,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => "");
      throw new Error(`Zernio media upload failed (${uploadRes.status}): ${text.slice(0, 500)}`);
    }

    await this.#throwIfCancelled(input.jobId);
    await log("Phase 3/3: creating Zernio post");
    const createRes = await zernioFetch(credentials, "/posts", {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        content: input.caption ?? input.title ?? "",
        mediaItems: [{ type: "video", url: presign.publicUrl }],
        platforms: [
          {
            platform,
            accountId: zernioAccountId,
            platformSpecificData: this.#platformSpecificData(platform, input),
          },
        ],
        publishNow: true,
      }),
    });
    const data = await readZernioJson<Record<string, unknown>>(createRes, "Zernio create post");
    const post = (data.post ?? data) as Record<string, unknown>;
    const providerPostId = this.#postId(post);
    const url = this.#postUrl(post);

    await log(`Zernio post created${providerPostId ? `: ${providerPostId}` : ""}`);
    return { providerPostId: providerPostId ?? `zernio_${Date.now()}`, url };
  }

  #platformFromAccount(scopes: string | null): ReturnType<typeof zernioPlatformForDestination> {
    const match = scopes?.match(/zernio:(tiktok|facebook|instagram|youtube)/);
    return match?.[1] as ReturnType<typeof zernioPlatformForDestination> ?? null;
  }

  #platformSpecificData(platform: string, input: PublishVideoInput): Record<string, unknown> | undefined {
    if (platform === "youtube") {
      return {
        title: input.title ?? path.basename(input.videoPath),
        visibility: input.privacy ?? "private",
      };
    }
    if (platform === "tiktok") {
      return {
        tiktokSettings: {
          privacy_level: input.privacy === "private" ? "SELF_ONLY" : "PUBLIC_TO_EVERYONE",
          allow_comment: true,
          allow_duet: true,
          allow_stitch: true,
          content_preview_confirmed: true,
          express_consent_given: true,
        },
      };
    }
    if (platform === "facebook" && input.contentType === "Reel") {
      return { contentType: "reel" };
    }
    return undefined;
  }

  #postId(post: Record<string, unknown>): string | undefined {
    return (
      this.#asString(post._id) ??
      this.#asString(post.id) ??
      this.#asString(post.postId) ??
      this.#asString((post.platforms as Record<string, unknown>[] | undefined)?.[0]?.platformPostId)
    );
  }

  #postUrl(post: Record<string, unknown>): string | undefined {
    return (
      this.#asString(post.platformPostUrl) ??
      this.#asString(post.url) ??
      this.#asString((post.platforms as Record<string, unknown>[] | undefined)?.[0]?.platformPostUrl)
    );
  }

  #asString(value: unknown): string | undefined {
    return typeof value === "string" && value ? value : undefined;
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
