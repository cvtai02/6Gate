import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { accounts, providers } from "@/server/db/schema";
import { handleCallback } from "@/server/auth/oauth-service";
import type { OauthCallbackDto } from "../../dtos/oauth-callback.dto";

@Injectable()
export class HandleOauthCallbackUseCase {
  async execute(input: OauthCallbackDto) {
    const db = getDb();
    const provider = await db
      .select({ type: providers.type })
      .from(providers)
      .where(eq(providers.id, input.providerId))
      .then((r) => r[0]);
    const returnBase = provider?.type ? `/providers/${provider.type}` : "/providers";

    try {
      await handleCallback(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `${returnBase}?error=${encodeURIComponent(message)}`;
    }

    const latest = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.providerId, input.providerId))
      .orderBy(desc(accounts.createdAt))
      .limit(1)
      .then((r) => r[0]);
    const accountParam = latest?.id ? `&accountId=${latest.id}` : "";
    return `${returnBase}?connected=1${accountParam}`;
  }
}
