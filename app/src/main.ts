import "reflect-metadata";
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Load .env bootstrap settings (SYSTEM_SECRET, ENCRYPTION_KEY, ...) without
// overriding shell env vars.
const envPath = join(process.cwd(), ".env");
let envLines: string[] = [];
try {
  envLines = readFileSync(envPath, "utf8").split("\n");
  for (const line of envLines) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

// Auto-generate secrets on first boot (replaces the "changeme" default).
//   SYSTEM_SECRET  — auth: login + JWT signing + x-system-secret header
//   ENCRYPTION_KEY — AES-256-GCM key for sensitive values stored in the DB
// A regenerated ENCRYPTION_KEY can't decrypt existing data, so this only ever
// fills in a missing/placeholder key on a fresh install — it never rotates one.
for (const name of ["SYSTEM_SECRET", "ENCRYPTION_KEY"]) {
  if (process.env[name] && process.env[name] !== "changeme") continue;
  const secret = randomBytes(32).toString("hex");
  process.env[name] = secret;
  const re = new RegExp(`^\\s*${name}=`);
  let found = false;
  envLines = envLines.map((l) => (re.test(l) ? ((found = true), `${name}=${secret}`) : l));
  if (!found) envLines.push(`${name}=${secret}`);
  try {
    writeFileSync(envPath, envLines.join("\n"), "utf8");
    console.log(`[6Gate] Generated ${name} and saved to .env`);
  } catch (e) {
    console.warn(`[6Gate] Could not write generated ${name} to .env:`, e);
  }
}

import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { env } from "@/server/config/env";
import { getDb } from "@/server/db";
import { runMigrations } from "@/server/db/migrate";
import { settings } from "@/server/db/schema";
import { eq } from "drizzle-orm";

async function readPort() {
  const db = getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, "port")).limit(1);
  return row ? Number(row.value) : env.port;
}

async function bootstrap() {
  // Ensure the Postgres schema exists before any provider/query runs.
  await runMigrations();
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "*",
    credentials: false,
  });
  app.setGlobalPrefix("api");
  app.use(json({ limit: "2gb" }));
  app.use(urlencoded({ limit: "2gb", extended: true }));
  await app.listen(await readPort());
}

bootstrap();
