import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { groups, groupDestinations, publishDestinations, accounts, providers } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
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

  return Response.json(
    allGroups.map((g) => ({
      ...g,
      destinations: destsByGroup.get(g.id) ?? [],
    }))
  );
}

export async function POST(req: Request) {
  const { name } = await req.json();
  if (!name?.trim()) return Response.json({ error: "Name is required" }, { status: 400 });

  const db = getDb();
  const id = `group_${nanoid(8)}`;
  const now = new Date().toISOString();
  await db.insert(groups).values({ id, name: name.trim(), createdAt: now });
  const row = await db.select().from(groups).where(eq(groups.id, id)).get();
  return Response.json({ ...row, destinations: [] }, { status: 201 });
}
