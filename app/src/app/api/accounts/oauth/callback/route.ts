import { handleCallback } from "@/server/auth/oauth-service";
import { getDb } from "@/server/db";
import { providers, accounts } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const code = search.get("code");
  const rawState = search.get("state") ?? "";
  // State is either "providerId.verifier" (TikTok PKCE) or just "providerId" (other providers).
  const dot = rawState.indexOf(".");
  const decodedProviderId = dot !== -1 ? rawState.slice(0, dot) : rawState;
  const providerId = search.get("provider_id") || decodedProviderId;

  if (!code || !providerId) {
    return Response.json({ error: "Missing code or provider_id" }, { status: 400 });
  }

  // Look up provider type so we can redirect back to the detail page
  let providerType: string | null = null;
  try {
    const db = getDb();
    const provider = await db
      .select({ type: providers.type })
      .from(providers)
      .where(eq(providers.id, providerId))
      .get();
    providerType = provider?.type ?? null;
  } catch {
    // fallback: will redirect to /providers
  }

  const returnBase = providerType ? `/providers/${providerType}` : "/providers";

  let errorMsg: string | null = null;
  try {
    await handleCallback({ providerId, code, state: search.get("state") ?? undefined });
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  if (errorMsg) {
    redirect(`${returnBase}?error=${encodeURIComponent(errorMsg)}`);
  } else {
    // Find the account that was just created so the client can trigger a sync
    let accountId: string | null = null;
    try {
      const db = getDb();
      const latest = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.providerId, providerId))
        .orderBy(desc(accounts.createdAt))
        .limit(1)
        .get();
      accountId = latest?.id ?? null;
    } catch {}
    const accountParam = accountId ? `&accountId=${accountId}` : "";
    redirect(`${returnBase}?connected=1${accountParam}`);
  }
}
