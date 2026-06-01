import { Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ProviderDto } from "@sixgate/api-client";
import { getDb } from "@/server/db";
import { accounts, groupDestinations, jobLogs, postJobs, providers, publishDestinations } from "@/server/db/schema";

@Injectable()
export class ProvidersUseCases {
  list(): ProviderDto[] {
    return getDb().select().from(providers).orderBy(desc(providers.createdAt)).all();
  }

  async create(input: {
    name: string;
    type: string;
    clientId?: string;
    clientSecret?: string;
    authUrl?: string;
    tokenUrl?: string;
    scopes?: string[];
  }) {
    const db = getDb();
    const existing = await db.select({ id: providers.id }).from(providers).where(eq(providers.type, input.type)).get();
    if (existing) {
      throw new Error(`A ${input.type} app is already configured. Edit or remove it first.`);
    }
    const id = `prov_${nanoid(10)}`;
    const now = new Date().toISOString();
    await db.insert(providers).values({
      id,
      name: input.name,
      type: input.type,
      clientId: input.clientId ?? null,
      clientSecret: input.clientSecret ?? null,
      authUrl: input.authUrl ?? null,
      tokenUrl: input.tokenUrl ?? null,
      scopes: input.scopes ? input.scopes.join(",") : null,
      createdAt: now,
    });
    return db.select().from(providers).where(eq(providers.id, id)).get();
  }

  async get(id: string) {
    const row = await getDb().select().from(providers).where(eq(providers.id, id)).get();
    if (!row) throw new NotFoundException("Not found");
    return row;
  }

  async update(id: string, body: Record<string, unknown>) {
    const db = getDb();
    await this.get(id);
    const updates: Record<string, string | null> = {};
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
    if (typeof body.clientId === "string") updates.clientId = body.clientId.trim() || null;
    if (typeof body.clientSecret === "string" && body.clientSecret.trim()) updates.clientSecret = body.clientSecret.trim();
    if (typeof body.scopes === "string") updates.scopes = body.scopes.trim() || null;
    if (Array.isArray(body.scopes)) updates.scopes = body.scopes.join(",") || null;
    if (Object.keys(updates).length > 0) {
      await db.update(providers).set(updates).where(eq(providers.id, id));
    }
    return this.get(id);
  }

  async delete(id: string) {
    const db = getDb();
    await this.get(id);
    const providerAccounts = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.providerId, id)).all();
    for (const acc of providerAccounts) {
      const jobs = await db.select({ id: postJobs.id }).from(postJobs).where(eq(postJobs.accountId, acc.id)).all();
      for (const job of jobs) await db.delete(jobLogs).where(eq(jobLogs.jobId, job.id));
      const dests = await db.select({ id: publishDestinations.id }).from(publishDestinations).where(eq(publishDestinations.socialAccountId, acc.id)).all();
      for (const dest of dests) await db.delete(groupDestinations).where(eq(groupDestinations.destinationId, dest.id));
      await db.delete(publishDestinations).where(eq(publishDestinations.socialAccountId, acc.id));
      await db.delete(postJobs).where(eq(postJobs.accountId, acc.id));
    }
    await db.delete(accounts).where(eq(accounts.providerId, id));
    await db.delete(providers).where(eq(providers.id, id));
  }
}
