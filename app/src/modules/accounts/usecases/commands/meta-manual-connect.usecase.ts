import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { accounts, providers, publishDestinations } from "@/server/db/schema";
import { DestinationType } from "@/lib/enums";
import { syncInstagramForPage, syncThreadsForUser } from "@/server/providers/meta-ig-threads";
import type { MetaManualConnectDto } from "../../dtos/meta-manual-connect.dto";

@Injectable()
export class MetaManualConnectUseCase {
  async execute(input: MetaManualConnectDto) {
    const db = getDb();
    const provider = await db.select().from(providers).where(eq(providers.id, input.providerId)).get();
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
    await db.insert(publishDestinations).values({
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
