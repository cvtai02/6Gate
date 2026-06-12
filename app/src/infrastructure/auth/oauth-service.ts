import { getDb } from "@/infrastructure/db";
import { providers, accounts } from "@/infrastructure/db/schema";
import { eq } from "drizzle-orm";
import { getAdapter } from "@/infrastructure/providers/registry";

export async function startOAuth(providerId: string): Promise<string> {
  const db = getDb();
  const provider = await db
    .select()
    .from(providers)
    .where(eq(providers.id, providerId))
    .then((r) => r[0]);

  if (!provider) throw new Error(`Provider ${providerId} not found`);

  const adapter = getAdapter(provider.type);
  return adapter.getAuthUrl(providerId);
}

export async function handleCallback(input: {
  providerId: string;
  code: string;
  state?: string;
}) {
  const db = getDb();
  const provider = await db
    .select()
    .from(providers)
    .where(eq(providers.id, input.providerId))
    .then((r) => r[0]);

  if (!provider) throw new Error(`Provider ${input.providerId} not found`);

  const adapter = getAdapter(provider.type);
  await adapter.handleOAuthCallback(input);
}

export async function removeAccount(accountId: string) {
  const db = getDb();
  await db.delete(accounts).where(eq(accounts.id, accountId));
}
