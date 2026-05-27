import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import { env } from "@/server/config/env";
import { runMigrations } from "./migrate";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;

  const dbDir = path.dirname(env.dbPath);
  fs.mkdirSync(dbDir, { recursive: true });

  const sqlite = new Database(env.dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  _db = drizzle(sqlite);
  runMigrations(_db);

  return _db;
}

export type Db = ReturnType<typeof getDb>;
