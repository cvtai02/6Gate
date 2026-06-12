import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

let _pool: Pool | null = null;
let _db: NodePgDatabase | null = null;

function connectionString() {
  const url = process.env.DATABASE_CONNECTION_STRING ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_CONNECTION_STRING is not set. Provide a Postgres connection string, e.g. " +
        "postgresql://user:pass@host:5432/sixgate",
    );
  }
  return url;
}

/**
 * SSL config. Many managed/remote Postgres servers require TLS (their pg_hba.conf
 * rejects unencrypted connections). Enable by setting DATABASE_SSL to one of
 * "require" / "true" / "1" / "no-verify". rejectUnauthorized is false because these
 * servers commonly present self-signed certificates. Leave unset for local/Docker
 * Postgres without TLS.
 */
function sslConfig() {
  const v = (process.env.DATABASE_SSL ?? "").toLowerCase();
  if (["require", "true", "1", "no-verify", "yes"].includes(v)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export function getPool() {
  if (_pool) return _pool;
  // The connection string is read lazily so main.ts can load .env first.
  _pool = new Pool({ connectionString: connectionString(), ssl: sslConfig() });
  return _pool;
}

export function getDb() {
  if (_db) return _db;
  _db = drizzle(getPool());
  return _db;
}

export type Db = ReturnType<typeof getDb>;

/** Close the pool — used by graceful shutdown and one-off scripts. */
export async function closeDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}
