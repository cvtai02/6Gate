import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { accounts, groupDestinations, groups, providers, destinations } from "@/server/db/schema";

@Injectable()
export class ListGroupsUseCase {
  async execute() {
    const db = getDb();
    const allGroups = await db.select().from(groups).orderBy(desc(groups.createdAt));
    const allLinks = await db
      .select({
        groupId: groupDestinations.groupId,
        destinationId: destinations.id,
        name: destinations.name,
        type: destinations.type,
        externalId: destinations.externalId,
        socialAccountId: destinations.socialAccountId,
        avatarUrl: destinations.avatarUrl,
        providerType: providers.type,
        providerName: providers.name,
        accountAvatarUrl: accounts.avatarUrl,
      })
      .from(groupDestinations)
      .leftJoin(destinations, eq(groupDestinations.destinationId, destinations.id))
      .leftJoin(accounts, eq(destinations.socialAccountId, accounts.id))
      .leftJoin(providers, eq(accounts.providerId, providers.id))
      ;

    const destsByGroup = new Map<string, typeof allLinks>();
    for (const link of allLinks) {
      if (!destsByGroup.has(link.groupId)) destsByGroup.set(link.groupId, []);
      destsByGroup.get(link.groupId)!.push(link);
    }

    return allGroups.map((group) => ({
      ...group,
      destinations: destsByGroup.get(group.id) ?? [],
    }));
  }
}
