import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, providers } from "@/infrastructure/db/schema";
import type { AccountFiltersDto } from "../../dtos/account-filters.dto";

@Injectable()
export class ListAccountsUseCase {
  async execute(filters: AccountFiltersDto) {
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
      ;
    return rows.filter((r) => (!filters.type || r.providerType === filters.type) && (!filters.providerId || r.providerId === filters.providerId));
  }
}
