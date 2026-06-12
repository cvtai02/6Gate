import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, providers, destinations } from "@/infrastructure/db/schema";
import type { DestinationFiltersDto } from "../../dtos/destination-filters.dto";

@Injectable()
export class ListDestinationsUseCase {
  async execute(filters: DestinationFiltersDto) {
    let rows = await getDb()
      .select({
        id: destinations.id,
        socialAccountId: destinations.socialAccountId,
        name: destinations.name,
        type: destinations.type,
        externalId: destinations.externalId,
        avatarUrl: destinations.avatarUrl,
        createdAt: destinations.createdAt,
        providerType: providers.type,
        providerName: providers.name,
        accountProviderId: accounts.providerId,
        accountUsername: accounts.username,
        accountAvatarUrl: accounts.avatarUrl,
      })
      .from(destinations)
      .leftJoin(accounts, eq(destinations.socialAccountId, accounts.id))
      .leftJoin(providers, eq(accounts.providerId, providers.id))
      .orderBy(desc(destinations.createdAt))
      ;
    if (filters.type) rows = rows.filter((r) => r.providerType === filters.type);
    if (filters.providerId) rows = rows.filter((r) => r.accountProviderId === filters.providerId);
    return rows;
  }
}
