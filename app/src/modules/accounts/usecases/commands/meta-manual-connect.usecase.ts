import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/infrastructure/db";
import { accounts, providers, destinations } from "@/infrastructure/db/schema";
import { DestinationType } from "@/core/enums";
import { syncInstagramForPage, syncThreadsForUser } from "@/infrastructure/providers/meta-ig-threads";
import type { MetaManualConnectDto } from "../../dtos/meta-manual-connect.dto";

@Injectable()
export class MetaManualConnectUseCase {
  async execute(input: MetaManualConnectDto) {
    const db = getDb();
    const provider = await db.select().from(providers).where(eq(providers.id, input.providerId)).then((r) => r[0]);
    if (!provider) throw new Error("Provider not found");
    const now = new Date().toISOString();
    const accountId = `acc_fb_${nanoid(8)}`;
    await db.insert(accounts).values({
      id: accountId,
      providerId: input.providerId,
      providerAccountId: null,
      displayName: "Meta Account",
      username: null,
      avatarUrl: null,
      accessToken: input.accessToken,
      refreshToken: input.accessToken,
      expiresAt: null,
      scopes: null,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(destinations).values({
      id: `dest_${nanoid(8)}`,
      socialAccountId: accountId,
      name: "Facebook Page",
      type: DestinationType.facebook_page,
      externalId: null,
      accessToken: input.accessToken,
      avatarUrl: null,
      createdAt: now,
    });
    await syncThreadsForUser(accountId, input.accessToken, now).catch(() => undefined);
    await syncInstagramForPage(accountId, "", input.accessToken, now).catch(() => undefined);
    return { added: 1, skipped: 0 };
  }
}
