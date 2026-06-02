import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { accounts, providers, publishDestinations } from "@/server/db/schema";
import type { DestinationFiltersDto } from "../../dtos/destination-filters.dto";

@Injectable()
export class ListDestinationsUseCase {
  async execute(filters: DestinationFiltersDto) {
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
}
