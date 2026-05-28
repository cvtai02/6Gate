import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { publishDestinations, accounts, providers } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const typeFilter = searchParams.get("type");
  const providerIdFilter = searchParams.get("providerId");

  const db = getDb();
  let rows = await db
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

  if (typeFilter) rows = rows.filter((r) => r.providerType === typeFilter);
  if (providerIdFilter) rows = rows.filter((r) => r.accountProviderId === providerIdFilter);

  return Response.json(rows);
}

export async function POST(req: Request) {
  const { socialAccountId, name, type, externalId } = await req.json();
  if (!socialAccountId || !name || !type) {
    return Response.json({ error: "socialAccountId, name and type are required" }, { status: 400 });
  }
  const db = getDb();
  const id = `dest_${nanoid(8)}`;
  await db.insert(publishDestinations).values({
    id,
    socialAccountId,
    name,
    type,
    externalId: externalId ?? null,
    createdAt: new Date().toISOString(),
  });
  const row = await db.select().from(publishDestinations).where(eq(publishDestinations.id, id)).get();
  return Response.json(row, { status: 201 });
}
