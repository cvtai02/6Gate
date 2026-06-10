import "reflect-metadata";
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Load .env bootstrap settings (SYSTEM_SECRET, etc.) without overriding shell env vars.
const envPath = join(process.cwd(), ".env");
let envLines: string[] = [];
try {
  envLines = readFileSync(envPath, "utf8").split("\n");
  for (const line of envLines) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

// Auto-generate SYSTEM_SECRET on first boot (replaces the "changeme" default).
if (!process.env.SYSTEM_SECRET || process.env.SYSTEM_SECRET === "changeme") {
  const secret = randomBytes(32).toString("hex");
  process.env.SYSTEM_SECRET = secret;
  const updated = envLines.map((l) =>
    /^\s*SYSTEM_SECRET=/.test(l) ? `SYSTEM_SECRET=${secret}` : l,
  );
  if (!updated.some((l) => /^\s*SYSTEM_SECRET=/.test(l))) updated.push(`SYSTEM_SECRET=${secret}`);
  try {
    writeFileSync(envPath, updated.join("\n"), "utf8");
    console.log(`[6Gate] Generated SYSTEM_SECRET and saved to .env`);
  } catch (e) {
    console.warn("[6Gate] Could not write generated secret to .env:", e);
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
