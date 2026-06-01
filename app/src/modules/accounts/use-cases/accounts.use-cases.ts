import { Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { accounts, groupDestinations, jobLogs, postJobs, providers, publishDestinations } from "@/server/db/schema";
import { syncZernioAccount, syncZernioAccounts, createZernioAccount } from "@/server/providers/zernio-service";

@Injectable()
export class AccountsUseCases {
  async list(filters: { type?: string | null; providerId?: string | null }) {
    const rows = await getDb()
      .select({
        id: accounts.id,
        providerId: accounts.providerId,
        providerAccountId: accounts.providerAccountId,
        displayName: accounts.displayName,
        username: accounts.username,
        avatarUrl: accounts.avatarUrl,
        scopes: accounts.scopes,
        expiresAt: accounts.expiresAt,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
        providerName: providers.name,
        providerType: providers.type,
      })
      .from(accounts)
      .leftJoin(providers, eq(accounts.providerId, providers.id))
      .orderBy(desc(accounts.createdAt))
      .all();
    return rows.filter((r) => (!filters.type || r.providerType === filters.type) && (!filters.providerId || r.providerId === filters.providerId));
  }

  async rename(id: string, displayName: string) {
    const db = getDb();
    const row = await db.select().from(accounts).where(eq(accounts.id, id)).get();
    if (!row) throw new NotFoundException("Not found");
    await db.update(accounts).set({ displayName, updatedAt: new Date().toISOString() }).where(eq(accounts.id, id));
    return { id, displayName };
  }

  async delete(id: string) {
    const db = getDb();
    const row = await db.select().from(accounts).where(eq(accounts.id, id)).get();
    if (!row) throw new NotFoundException("Not found");
    const jobs = await db.select({ id: postJobs.id }).from(postJobs).where(eq(postJobs.accountId, id)).all();
    for (const job of jobs) await db.delete(jobLogs).where(eq(jobLogs.jobId, job.id));
    await db.delete(postJobs).where(eq(postJobs.accountId, id));
    const dests = await db.select({ id: publishDestinations.id }).from(publishDestinations).where(eq(publishDestinations.socialAccountId, id)).all();
    for (const dest of dests) await db.delete(groupDestinations).where(eq(groupDestinations.destinationId, dest.id));
    await db.delete(publishDestinations).where(eq(publishDestinations.socialAccountId, id));
    await db.delete(accounts).where(eq(accounts.id, id));
  }

  async addZernio(input: { providerId: string; name?: string; apiKey: string }) {
    return createZernioAccount(input.providerId, input.name?.trim() || "Zernio Account", input.apiKey);
  }

  async syncZernio(input: { providerId?: string; accountId?: string }) {
    if (input.accountId) return syncZernioAccount(input.accountId);
    if (!input.providerId) throw new Error("providerId is required");
    return syncZernioAccounts(input.providerId);
  }
}

