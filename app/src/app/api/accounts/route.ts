import { getDb } from "@/server/db";
import { accounts, providers } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const typeFilter = searchParams.get("type");
  const providerIdFilter = searchParams.get("providerId");

  const db = getDb();
  const query = db
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
    .orderBy(desc(accounts.createdAt));

  let rows = await query.all();

  if (typeFilter) rows = rows.filter((r) => r.providerType === typeFilter);
  if (providerIdFilter) rows = rows.filter((r) => r.providerId === providerIdFilter);

  return Response.json(rows);
}
