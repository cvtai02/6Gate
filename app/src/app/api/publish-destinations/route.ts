import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { publishDestinations, accounts, providers } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = await db
    .select({
      id: publishDestinations.id,
      socialAccountId: publishDestinations.socialAccountId,
      name: publishDestinations.name,
      type: publishDestinations.type,
      externalId: publishDestinations.externalId,
      createdAt: publishDestinations.createdAt,
      providerType: providers.type,
      providerName: providers.name,
      accountUsername: accounts.username,
    })
    .from(publishDestinations)
    .leftJoin(accounts, eq(publishDestinations.socialAccountId, accounts.id))
    .leftJoin(providers, eq(accounts.providerId, providers.id))
    .orderBy(desc(publishDestinations.createdAt))
    .all();
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
