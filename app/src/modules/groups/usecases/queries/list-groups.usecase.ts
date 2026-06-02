import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { accounts, groupDestinations, groups, providers, publishDestinations } from "@/server/db/schema";

@Injectable()
export class ListGroupsUseCase {
  async execute() {
    const db = getDb();
    const allGroups = await db.select().from(groups).orderBy(desc(groups.createdAt)).all();
    const allLinks = await db
      .select({
        groupId: groupDestinations.groupId,
        destinationId: publishDestinations.id,
        name: publishDestinations.name,
        type: publishDestinations.type,
        externalId: publishDestinations.externalId,
        socialAccountId: publishDestinations.socialAccountId,
        avatarUrl: publishDestinations.avatarUrl,
        providerType: providers.type,
        providerName: providers.name,
        accountAvatarUrl: accounts.avatarUrl,
      })
      .from(groupDestinations)
      .leftJoin(publishDestinations, eq(groupDestinations.destinationId, publishDestinations.id))
      .leftJoin(accounts, eq(publishDestinations.socialAccountId, accounts.id))
      .leftJoin(providers, eq(accounts.providerId, providers.id))
      .all();

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
