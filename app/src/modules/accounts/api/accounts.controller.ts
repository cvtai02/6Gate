import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { AccountsUseCases } from "../use-cases/accounts.use-cases";
import { syncInstagramForPage, syncThreadsForUser } from "@/server/providers/meta-ig-threads";
import { getDb } from "@/server/db";
import { accounts, providers, publishDestinations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { DestinationType, ProviderType } from "@/lib/enums";
import { nanoid } from "nanoid";

@Controller("accounts")
export class AccountsController {
  constructor(private readonly accountsUseCases: AccountsUseCases) {}

  @Get()
  list(@Query("type") type?: string, @Query("providerId") providerId?: string) {
    return this.accountsUseCases.list({ type, providerId });
  }

  @Patch(":id")
  rename(@Param("id") id: string, @Body() body: { displayName?: string }) {
    if (!body.displayName?.trim()) throw new Error("displayName is required");
    return this.accountsUseCases.rename(id, body.displayName.trim());
  }

  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string) {
    await this.accountsUseCases.delete(id);
  }

  @Post("zernio/add")
  addZernio(@Body() body: { providerId: string; name?: string; apiKey: string }) {
    return this.accountsUseCases.addZernio(body);
  }

  @Post("zernio/sync")
  syncZernio(@Body() body: { providerId?: string; accountId?: string }) {
    return this.accountsUseCases.syncZernio(body);
  }

  @Post(":id/sync-destinations")
  async syncDestinations(@Param("id") id: string) {
    const db = getDb();
    const account = await db.select().from(accounts).where(eq(accounts.id, id)).get();
    if (!account) return { error: "Not found" };
    const provider = await db.select().from(providers).where(eq(providers.id, account.providerId)).get();
    if (!provider) return { error: "Provider not found" };
    if (provider.type === ProviderType.zernio) {
      await this.accountsUseCases.syncZernio({ accountId: id });
      const dests = await db.select().from(publishDestinations).where(eq(publishDestinations.socialAccountId, id)).all();
      return { destinations: dests };
    }
    const existing = await db.select().from(publishDestinations).where(eq(publishDestinations.socialAccountId, id)).all();
    return { destinations: existing, warning: existing.length === 0 ? "No destinations available for this account." : undefined };
  }

  @Post(":id/sync")
  async syncBasic(@Param("id") id: string) {
    return this.syncDestinations(id);
  }

  @Post("meta/manual-connect")
  async metaManualConnect(@Body() body: { providerId: string; accessToken: string }) {
    const db = getDb();
    const provider = await db.select().from(providers).where(eq(providers.id, body.providerId)).get();
    if (!provider) throw new Error("Provider not found");
    const now = new Date().toISOString();
    const accountId = `acc_fb_${nanoid(8)}`;
    await db.insert(accounts).values({
      id: accountId,
      providerId: body.providerId,
      providerAccountId: null,
      displayName: "Meta Account",
      username: null,
      avatarUrl: null,
      accessToken: body.accessToken,
      refreshToken: body.accessToken,
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
      accessToken: body.accessToken,
      avatarUrl: null,
      createdAt: now,
    });
    await syncThreadsForUser(accountId, body.accessToken, now).catch(() => undefined);
    await syncInstagramForPage(accountId, "", body.accessToken, now).catch(() => undefined);
    return { added: 1, skipped: 0 };
  }

  @Post("meta/sync")
  async metaSync(@Body() body: { providerId: string }) {
    const rows = await this.accountsUseCases.list({ providerId: body.providerId });
    return { created: 0, updated: rows.length, deleted: 0 };
  }
}

