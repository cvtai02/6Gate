import { getPool } from "./index";

/**
 * Postgres schema bootstrap + data fix-ups. Idempotent: safe to run on every boot.
 * Ported from the original SQLite migrate.ts. Uses `IF NOT EXISTS` / `IF EXISTS` /
 * `ON CONFLICT DO NOTHING` instead of SQLite's try-catch-around-ALTER idiom.
 */
export async function runMigrations() {
  const pool = getPool();

  const run = async (sql: string) => {
    await pool.query(sql);
  };
  // For statements that may legitimately fail when a precondition is absent
  // (e.g. migrating from a legacy table that never existed).
  const tryRun = async (sql: string) => {
    try {
      await pool.query(sql);
    } catch {
      /* ignore */
    }
  };

  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      client_id TEXT,
      client_secret TEXT,
      auth_url TEXT,
      token_url TEXT,
      scopes TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await run(`ALTER TABLE providers ADD COLUMN IF NOT EXISTS pkce_verifier TEXT`);

  await run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      provider_account_id TEXT,
      display_name TEXT,
      username TEXT,
      avatar_url TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expires_at TEXT,
      scopes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS post_jobs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      destination_id TEXT,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      group_id TEXT,
      upload_batch_id TEXT,
      video_path TEXT NOT NULL,
      title TEXT,
      caption TEXT,
      privacy TEXT,
      scheduled_at TEXT,
      provider_post_id TEXT,
      provider_post_url TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`ALTER TABLE post_jobs ADD COLUMN IF NOT EXISTS destination_id TEXT`);

  // Rename legacy publish_destinations -> destinations (idempotent, preserves data).
  await run(`
    DO $$
    BEGIN
      IF to_regclass('public.publish_destinations') IS NOT NULL
         AND to_regclass('public.destinations') IS NULL THEN
        ALTER TABLE publish_destinations RENAME TO destinations;
      END IF;
    END $$;
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS destinations (
      id TEXT PRIMARY KEY,
      social_account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      external_id TEXT,
      access_token TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await run(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS access_token TEXT`);
  await run(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS avatar_url TEXT`);

  // Rename legacy "Facebook" provider names/types to "Meta" (idempotent)
  await run(`UPDATE providers SET name = 'Meta' WHERE type = 'facebook' AND name != 'Meta'`);
  await run(`UPDATE providers SET type = 'meta' WHERE type = 'facebook'`);

  // Fix TikTok scopes to the correct set required by TikTok's current API (idempotent)
  await run(`UPDATE providers SET scopes = 'user.info.basic,video.upload,video.publish' WHERE type = 'tiktok'`);

  await run(`
    CREATE TABLE IF NOT EXISTS video_folders (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      label TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS job_logs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS combos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // Legacy: combo_accounts was the old group->account join table, replaced by
  // combo_destinations. Unused and always empty — drop it if it exists.
  await run(`DROP TABLE IF EXISTS combo_accounts`);

  await run(`
    CREATE TABLE IF NOT EXISTS combo_destinations (
      id TEXT PRIMARY KEY,
      combo_id TEXT NOT NULL,
      destination_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (combo_id, destination_id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS group_upload_queue (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      video_path TEXT NOT NULL,
      title TEXT,
      caption TEXT,
      privacy TEXT,
      status TEXT NOT NULL,
      upload_batch_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Drop scheduled_at from group_upload_queue — dispatch timing is controlled by upload_time_in_day
  await run(`ALTER TABLE group_upload_queue DROP COLUMN IF EXISTS scheduled_at`);

  await run(`
    CREATE TABLE IF NOT EXISTS group_upload_settings (
      group_id TEXT PRIMARY KEY,
      upload_time_in_day TEXT NOT NULL,
      last_triggered_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_group_upload_queue_pick ON group_upload_queue(group_id, status, created_at)`);

  // Resilient-job columns on post_jobs (idempotent)
  const postJobsColumns: [string, string][] = [
    ["content_type", "TEXT"],
    ["group_id", "TEXT"],
    ["upload_batch_id", "TEXT"],
    ["upload_session_id", "TEXT"],
    ["upload_session_url", "TEXT"],
    ["upload_url", "TEXT"],
    ["start_offset", "TEXT"],
    ["end_offset", "TEXT"],
    ["uploaded_bytes", "TEXT"],
    ["total_bytes", "TEXT"],
    ["attempt_count", "TEXT"],
    ["max_attempts", "TEXT"],
    ["next_attempt_at", "TEXT"],
    ["last_status_checked_at", "TEXT"],
    ["last_error_code", "TEXT"],
    ["last_error_subcode", "TEXT"],
    ["last_network_error", "TEXT"],
    ["last_trace_id", "TEXT"],
    ["reconnect_required_reason", "TEXT"],
    ["idempotency_key", "TEXT"],
    ["published_at", "TEXT"],
  ];
  for (const [name, type] of postJobsColumns) {
    await run(`ALTER TABLE post_jobs ADD COLUMN IF NOT EXISTS ${name} ${type}`);
  }

  // Unique index for idempotency lookup; NULLs are allowed and don't collide.
  await run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_post_jobs_idempotency_key ON post_jobs(idempotency_key) WHERE idempotency_key IS NOT NULL`,
  );

  // Backfill legacy lowercase status values to the new PublishStatus enum.
  await run(`UPDATE post_jobs SET status = 'Created'   WHERE status = 'queued'`);
  await run(`UPDATE post_jobs SET status = 'Uploading' WHERE status = 'running'`);
  await run(`UPDATE post_jobs SET status = 'Published' WHERE status = 'completed'`);
  await run(`UPDATE post_jobs SET status = 'Failed'    WHERE status = 'failed'`);

  await run(`
    CREATE TABLE IF NOT EXISTS router7 (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT,
      access_token TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Migrate data from old 'storage' table if it exists.
  await tryRun(`INSERT INTO router7 SELECT id, name, base_url, access_token, created_at, updated_at FROM storage ON CONFLICT (id) DO NOTHING`);
  await tryRun(`DROP TABLE IF EXISTS storage`);

  // Seed "7router" if it doesn't exist, migrating any access token from the settings table.
  await run(`
    INSERT INTO router7 (id, name, access_token, created_at, updated_at)
    VALUES (
      '7router',
      '7router',
      (SELECT value FROM settings WHERE key = 'storageAccessToken'),
      to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
    ON CONFLICT (id) DO NOTHING
  `);

  // Notification channels — replaces per-group telegram columns with a many-to-many table
  await run(`
    CREATE TABLE IF NOT EXISTS group_notification_channels (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      chat_name TEXT,
      created_at TEXT NOT NULL
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_gnc_group ON group_notification_channels(group_id)`);

  // Migrate legacy per-group telegram columns into the new table
  await run(`ALTER TABLE combos ADD COLUMN IF NOT EXISTS telegram_bot_account_id TEXT`);
  await run(`ALTER TABLE combos ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT`);
  await run(`
    INSERT INTO group_notification_channels (id, group_id, account_id, chat_id, created_at)
    SELECT
      'migrated-' || id,
      id,
      telegram_bot_account_id,
      telegram_chat_id,
      to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    FROM combos
    WHERE telegram_bot_account_id IS NOT NULL
      AND telegram_chat_id IS NOT NULL
    ON CONFLICT (id) DO NOTHING
  `);

  // Remove settings that don't belong here.
  await run(
    `DELETE FROM settings WHERE key IN ('dataDir','dbPath','uploadsDir','logsDir','configDir','port','zernioBaseUrl','storageAccessToken','storageBaseDirectory')`,
  );
}
