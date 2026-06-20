/**
 * One-time data migration: copies all rows from the legacy SQLite database into
 * the new Postgres database. Run AFTER `npm run db:migrate` (which creates the
 * Postgres schema).
 *
 *   npm run db:import-sqlite
 *
 * Idempotent: uses INSERT ... ON CONFLICT (primary key) DO NOTHING, so re-running
 * will not duplicate rows. Only columns that exist in BOTH databases are copied,
 * so legacy/dropped columns (e.g. group_upload_queue.scheduled_at) are ignored.
 */
import Database from "better-sqlite3";
import { loadEnv } from "../src/infrastructure/db/load-env";
import { env } from "../src/infrastructure/config/env";

loadEnv();

// Imported AFTER loadEnv() so getPool() reads DATABASE_CONNECTION_STRING / DATABASE_SSL.
import { getPool, closeDb } from "../src/infrastructure/db/index";

// Postgres tables to populate, with their primary-key column (for ON CONFLICT).
// `source` is the SQLite table name when it differs from the Postgres name (e.g.
// after a table rename); defaults to `name`.
const TABLES: { name: string; pk: string; source?: string }[] = [
  { name: "settings", pk: "key" },
  { name: "providers", pk: "id" },
  { name: "accounts", pk: "id" },
  { name: "post_jobs", pk: "id" },
  { name: "video_folders", pk: "id" },
  { name: "job_logs", pk: "id" },
  { name: "combos", pk: "id" },
  { name: "destinations", pk: "id", source: "publish_destinations" },
  { name: "combo_destinations", pk: "id" },
  { name: "group_upload_queue", pk: "id" },
  { name: "group_upload_settings", pk: "group_id" },
];

async function main() {
  const dbUrl = process.env.DATABASE_CONNECTION_STRING ?? process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_CONNECTION_STRING is not set");

  console.log(`[import] source SQLite : ${env.dbPath}`);
  console.log(`[import] target Postgres: ${dbUrl.replace(/:[^:@/]+@/, ":****@")}`);

  const sqlite = new Database(env.dbPath, { readonly: true, fileMustExist: true });
  const pool = getPool();

  try {
    for (const { name, pk, source } of TABLES) {
      const src = source ?? name;
      // Skip tables that don't exist in the source DB.
      const exists = sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
        .get(src);
      if (!exists) {
        console.log(`[import] ${name}: not in source, skipped`);
        continue;
      }

      // Columns present in the Postgres target.
      const pgColsRes = await pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1`,
        [name],
      );
      const pgCols = new Set(pgColsRes.rows.map((r) => r.column_name));

      const rows = sqlite.prepare(`SELECT * FROM ${src}`).all() as Record<string, unknown>[];
      if (rows.length === 0) {
        console.log(`[import] ${name}: 0 rows`);
        continue;
      }

      // Only copy columns that exist in BOTH databases.
      const cols = Object.keys(rows[0]).filter((c) => pgCols.has(c));
      const colList = cols.map((c) => `"${c}"`).join(", ");

      let inserted = 0;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        const sql = `INSERT INTO "${name}" (${colList}) VALUES (${placeholders}) ON CONFLICT ("${pk}") DO NOTHING`;
        for (const row of rows) {
          const values = cols.map((c) => (row[c] === undefined ? null : row[c]));
          const res = await client.query(sql, values);
          inserted += res.rowCount ?? 0;
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }

      console.log(`[import] ${name}: ${rows.length} read, ${inserted} inserted (${cols.length} cols)`);
    }

    console.log("[import] done.");
  } finally {
    sqlite.close();
    await closeDb();
  }
}

main().catch((err) => {
  console.error("[import] failed:", err);
  process.exit(1);
});
