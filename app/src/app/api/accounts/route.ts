import { getDb } from "@/server/db";
import { accounts, providers } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = await db
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
    .all();
  return Response.json(rows);
}
