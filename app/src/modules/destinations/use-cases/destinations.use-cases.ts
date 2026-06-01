import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { accounts, groupDestinations, providers, publishDestinations } from "@/server/db/schema";

@Injectable()
export class DestinationsUseCases {
  async list(filters: { type?: string | null; providerId?: string | null }) {
    let rows = await getDb()
      .select({
        id: publishDestinations.id,
        socialAccountId: publishDestinations.socialAccountId,
        name: publishDestinations.name,
        type: publishDestinations.type,
        externalId: publishDestinations.externalId,
        avatarUrl: publishDestinations.avatarUrl,
        createdAt: publishDestinations.createdAt,
        providerType: providers.type,
        providerName: providers.name,
        accountProviderId: accounts.providerId,
        accountUsername: accounts.username,
        accountAvatarUrl: accounts.avatarUrl,
      })
      .from(publishDestinations)
      .leftJoin(accounts, eq(publishDestinations.socialAccountId, accounts.id))
      .leftJoin(providers, eq(accounts.providerId, providers.id))
      .orderBy(desc(publishDestinations.createdAt))
      .all();
    if (filters.type) rows = rows.filter((r) => r.providerType === filters.type);
    if (filters.providerId) rows = rows.filter((r) => r.accountProviderId === filters.providerId);
    return rows;
  }

  async create(input: { socialAccountId: string; name: string; type: string; externalId?: string | null }) {
    const id = `dest_${nanoid(8)}`;
    await getDb().insert(publishDestinations).values({
      id,
      socialAccountId: input.socialAccountId,
      name: input.name,
      type: input.type,
      externalId: input.externalId ?? null,
      createdAt: new Date().toISOString(),
    });
    return getDb().select().from(publishDestinations).where(eq(publishDestinations.id, id)).get();
  }

  async delete(id: string) {
    const db = getDb();
    await db.delete(groupDestinations).where(eq(groupDestinations.destinationId, id));
    await db.delete(publishDestinations).where(eq(publishDestinations.id, id));
  }
}

