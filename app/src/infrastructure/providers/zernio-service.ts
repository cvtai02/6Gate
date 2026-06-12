import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, groupDestinations, providers, destinations } from "@/infrastructure/db/schema";
import { DestinationType, ProviderType } from "@/core/enums";

export const ZERNIO_DEFAULT_BASE_URL = "https://zernio.com/api/v1";
export const ZERNIO_DOCS_URL = "https://docs.zernio.com/llms-full.txt";

type ZernioAccount = {
  _id?: string;
  id?: string;
  accountId?: string;
  platform?: string;
  username?: string | null;
  handle?: string | null;
  displayName?: string | null;
  name?: string | null;
  profileName?: string | null;
  avatarUrl?: string | null;
  picture?: string | null;
  profilePicture?: string | null;
  profilePictureUrl?: string | null;
};

export type ZernioPlatform = "tiktok" | "facebook" | "instagram" | "youtube" | "telegram";

const PLATFORM_TO_DESTINATION: Record<ZernioPlatform, DestinationType> = {
  tiktok: DestinationType.tiktok_account,
  facebook: DestinationType.facebook_page,
  instagram: DestinationType.instagram_account,
  youtube: DestinationType.youtube_channel,
  telegram: DestinationType.TelegramChat,
};

export function zernioPlatformForDestination(type?: string | null): ZernioPlatform | null {
  switch (type) {
    case DestinationType.tiktok_account:
      return "tiktok";
    case DestinationType.facebook_page:
      return "facebook";
    case DestinationType.instagram_account:
      return "instagram";
    case DestinationType.youtube_channel:
      return "youtube";
    case DestinationType.TelegramChat:
      return "telegram";
    default:
      return null;
  }
}

export function getZernioBaseUrl(provider: { clientId: string | null }): string {
  const maybeUrl = provider.clientId?.trim();
  if (maybeUrl && /^https?:\/\//i.test(maybeUrl)) return maybeUrl.replace(/\/+$/, "");
  return ZERNIO_DEFAULT_BASE_URL;
}

type ZernioCredentialSource = {
  name: string;
  clientId: string | null;
  clientSecret?: string | null;
  apiKey?: string | null;
};

export function getZernioApiKey(source: ZernioCredentialSource): string {
  const apiKey = source.apiKey?.trim() || source.clientSecret?.trim();
  if (!apiKey) throw new Error(`Zernio account "${source.name}" has no API key configured`);
  return apiKey;
}

export async function zernioFetch(
  provider: ZernioCredentialSource,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const baseUrl = getZernioBaseUrl(provider);
  const apiKey = getZernioApiKey(provider);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
  });
}

export async function readZernioJson<T>(
  res: Response,
  context: string
): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const error = data?.error ?? data?.message ?? text ?? `HTTP ${res.status}`;
    throw new Error(`${context}: ${error}`);
  }
  return data as T;
}

function accountId(account: ZernioAccount): string | null {
  return account._id ?? account.id ?? account.accountId ?? null;
}

function displayName(account: ZernioAccount, platform: string): string {
  return (
    account.displayName ??
    account.name ??
    account.profileName ??
    account.username ??
    account.handle ??
    `${platform[0]?.toUpperCase() ?? ""}${platform.slice(1)} Account`
  );
}

function username(account: ZernioAccount): string | null {
  return account.username ?? account.handle ?? null;
}

function avatarUrl(account: ZernioAccount): string | null {
  return account.avatarUrl ?? account.profilePictureUrl ?? account.profilePicture ?? account.picture ?? null;
}

function supportedPlatform(platform?: string | null): ZernioPlatform | null {
  if (!platform) return null;
  const normalized = platform.toLowerCase();
  return normalized in PLATFORM_TO_DESTINATION ? normalized as ZernioPlatform : null;
}

async function listZernioAccounts(credentials: ZernioCredentialSource) {
  const res = await zernioFetch(credentials, "/accounts", { signal: AbortSignal.timeout(30_000) });
  const data = await readZernioJson<{ accounts?: ZernioAccount[]; data?: ZernioAccount[] } | ZernioAccount[]>(
    res,
    "Zernio accounts"
  );
  return Array.isArray(data) ? data : data.accounts ?? data.data ?? [];
}

async function syncDestinationsForLocalAccount(input: {
  localAccountId: string;
  providerBaseUrl: string | null;
  apiKey: string | null;
  label: string;
}) {
  const db = getDb();
  const remoteAccounts = await listZernioAccounts({
    name: input.label,
    clientId: input.providerBaseUrl,
    apiKey: input.apiKey,
  });
  const now = new Date().toISOString();
  const result = { accounts: 0, destinations: 0, created: 0, updated: 0, skipped: 0 };
  const seenDestinationIds = new Set<string>();

  for (const remote of remoteAccounts) {
    const platform = supportedPlatform(remote.platform);
    const remoteId = accountId(remote);
    if (!platform || !remoteId) {
      result.skipped++;
      continue;
    }

    const name = displayName(remote, platform);
    const handle = username(remote);
    const avatar = avatarUrl(remote);
    const destinationType = PLATFORM_TO_DESTINATION[platform];

    const existingDestination = await db
      .select()
      .from(destinations)
      .where(and(eq(destinations.socialAccountId, input.localAccountId), eq(destinations.externalId, remoteId)))
      .then((r) => r[0]);

    if (existingDestination) {
      await db
        .update(destinations)
        .set({
          name,
          type: destinationType,
          avatarUrl: avatar,
        })
        .where(eq(destinations.id, existingDestination.id));
      seenDestinationIds.add(existingDestination.id);
      result.updated++;
    } else {
      const id = `dest_${nanoid(8)}`;
      await db.insert(destinations).values({
        id,
        socialAccountId: input.localAccountId,
        name,
        type: destinationType,
        externalId: remoteId,
        accessToken: null,
        avatarUrl: avatar,
        createdAt: now,
      });
      seenDestinationIds.add(id);
      result.created++;
    }

    result.accounts++;
    result.destinations++;
  }

  const localDestinations = await db
    .select()
    .from(destinations)
    .where(eq(destinations.socialAccountId, input.localAccountId))
    ;
  for (const destination of localDestinations) {
    if (!seenDestinationIds.has(destination.id)) {
      await db.delete(groupDestinations).where(eq(groupDestinations.destinationId, destination.id));
      await db.delete(destinations).where(eq(destinations.id, destination.id));
    }
  }

  return result;
}

export async function createZernioAccount(providerId: string, name: string, apiKey: string) {
  const db = getDb();
  const provider = await db.select().from(providers).where(eq(providers.id, providerId)).then((r) => r[0]);
  if (!provider) throw new Error("Provider not found");
  if (provider.type !== ProviderType.zernio) throw new Error("Provider is not a Zernio provider");

  const trimmedKey = apiKey.trim();
  if (!trimmedKey) throw new Error("apiKey is required");

  await listZernioAccounts({
    name,
    clientId: provider.clientId,
    apiKey: trimmedKey,
  });

  const now = new Date().toISOString();
  const accountId = `acc_zer_${nanoid(8)}`;
  await db.insert(accounts).values({
    id: accountId,
    providerId,
    providerAccountId: `zernio_${nanoid(10)}`,
    displayName: name.trim() || "Zernio Account",
    username: null,
    avatarUrl: null,
    accessToken: trimmedKey,
    refreshToken: null,
    expiresAt: null,
    scopes: "zernio:api-key",
    createdAt: now,
    updatedAt: now,
  });

  const sync = await syncZernioAccount(accountId);
  const row = await db.select().from(accounts).where(eq(accounts.id, accountId)).then((r) => r[0]);
  return { account: row, sync };
}

export async function syncZernioAccount(accountId: string) {
  const db = getDb();
  const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).then((r) => r[0]);
  if (!account) throw new Error("Account not found");

  const provider = await db.select().from(providers).where(eq(providers.id, account.providerId)).then((r) => r[0]);
  if (!provider) throw new Error("Provider not found");
  if (provider.type !== ProviderType.zernio) throw new Error("Provider is not a Zernio provider");

  const result = await syncDestinationsForLocalAccount({
    localAccountId: account.id,
    providerBaseUrl: provider.clientId,
    apiKey: account.accessToken ?? provider.clientSecret,
    label: account.displayName ?? provider.name,
  });
  await db
    .update(accounts)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(accounts.id, account.id));
  return result;
}

export async function syncZernioAccounts(providerId: string) {
  const db = getDb();
  const provider = await db.select().from(providers).where(eq(providers.id, providerId)).then((r) => r[0]);
  if (!provider) throw new Error("Provider not found");
  if (provider.type !== ProviderType.zernio) throw new Error("Provider is not a Zernio provider");

  const localAccounts = await db.select().from(accounts).where(eq(accounts.providerId, providerId));
  if (localAccounts.length === 0 && provider.clientSecret) {
    const legacy = await createZernioAccount(providerId, provider.name, provider.clientSecret);
    return {
      accounts: legacy.sync.accounts,
      destinations: legacy.sync.destinations,
      created: 1,
      updated: 0,
      skipped: legacy.sync.skipped,
    };
  }

  const total = { accounts: 0, destinations: 0, created: 0, updated: 0, skipped: 0 };
  for (const account of localAccounts) {
    const result = await syncZernioAccount(account.id);
    total.accounts += result.accounts;
    total.destinations += result.destinations;
    total.created += result.created;
    total.updated += result.updated;
    total.skipped += result.skipped;
  }
  return total;
}
