import { nanoid } from "nanoid";
import type { SocialProviderAdapter, PublishVideoInput, PublishVideoResult } from "./types";
import { getDb } from "@/server/db";
import { accounts, providers } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export class MockAdapter implements SocialProviderAdapter {
  id = "mock";
  name = "Mock Provider";

  async getAuthUrl(providerId: string): Promise<string> {
    return `http://localhost:20129/api/accounts/oauth/callback?code=mock_code&state=${providerId}&provider_id=${providerId}`;
  }

  async handleOAuthCallback(input: {
    providerId: string;
    code: string;
    state?: string;
  }): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    const provider = await db
      .select()
      .from(providers)
      .where(eq(providers.id, input.providerId))
      .then((r) => r[0]);

    if (!provider) throw new Error(`Provider ${input.providerId} not found`);

    await db.insert(accounts).values({
      id: `acc_mock_${nanoid(8)}`,
      providerId: input.providerId,
      providerAccountId: `mock_user_${nanoid(6)}`,
      displayName: "Mock Account",
      username: "mock_user",
      avatarUrl: null,
      accessToken: `mock_access_${nanoid(16)}`,
      refreshToken: `mock_refresh_${nanoid(16)}`,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      scopes: "mock:upload",
      createdAt: now,
      updatedAt: now,
    });
  }

  async refreshToken(accountId: string): Promise<void> {
    const db = getDb();
    await db
      .update(accounts)
      .set({
        accessToken: `mock_access_${nanoid(16)}`,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accounts.id, accountId));
  }

  async publishVideo(input: PublishVideoInput): Promise<PublishVideoResult> {
    await new Promise((r) => setTimeout(r, 2000));
    return {
      providerPostId: `mock_post_${nanoid(8)}`,
      url: `https://mock.example.com/posts/${nanoid(8)}`,
    };
  }

  async getPostStatus(providerPostId: string): Promise<string> {
    return "completed";
  }
}
