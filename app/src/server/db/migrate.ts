// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function runMigrations(db: any) {
  db.run(`
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

  // Add pkce_verifier column if not already present (idempotent)
  try { db.run(`ALTER TABLE providers ADD COLUMN pkce_verifier TEXT`); } catch {}

  // Add destination_id to post_jobs for per-destination routing (idempotent)
  try { db.run(`ALTER TABLE post_jobs ADD COLUMN destination_id TEXT`); } catch {}

  // Add access_token to publish_destinations for page-level tokens (Meta) (idempotent)
  try { db.run(`ALTER TABLE publish_destinations ADD COLUMN access_token TEXT`); } catch {}

  // Add avatar_url to publish_destinations for page/channel avatars (idempotent)
  try { db.run(`ALTER TABLE publish_destinations ADD COLUMN avatar_url TEXT`); } catch {}

  // Rename legacy "Facebook" provider names to "Meta" (idempotent)
  db.run(`UPDATE providers SET name = 'Meta' WHERE type = 'facebook' AND name != 'Meta'`);

  // Rename provider type 'facebook' → 'meta' (idempotent)
  db.run(`UPDATE providers SET type = 'meta' WHERE type = 'facebook'`);

  db.run(`
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
      updated_at TEXT NOT NULL,
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS post_jobs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      destination_id TEXT,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      video_path TEXT NOT NULL,
      title TEXT,
      caption TEXT,
      privacy TEXT,
      scheduled_at TEXT,
      provider_post_id TEXT,
      provider_post_url TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS video_folders (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      label TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS job_logs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES post_jobs(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS combos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS combo_accounts (
      id TEXT PRIMARY KEY,
      combo_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (combo_id) REFERENCES combos(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      UNIQUE (combo_id, account_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS publish_destinations (
      id TEXT PRIMARY KEY,
      social_account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      external_id TEXT,
      access_token TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (social_account_id) REFERENCES accounts(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS combo_destinations (
      id TEXT PRIMARY KEY,
      combo_id TEXT NOT NULL,
      destination_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (combo_id) REFERENCES combos(id),
      FOREIGN KEY (destination_id) REFERENCES publish_destinations(id),
      UNIQUE (combo_id, destination_id)
    )
  `);
}
