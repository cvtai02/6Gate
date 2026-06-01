import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { env } from "@/server/config/env";
import { getDb } from "@/server/db";
import { settings } from "@/server/db/schema";
import { eq } from "drizzle-orm";

async function readPort() {
  const db = getDb();
  const row = await db.select().from(settings).where(eq(settings.key, "port")).get();
  return row ? Number(row.value) : env.port;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix("api");
  app.use(json({ limit: "2gb" }));
  app.use(urlencoded({ limit: "2gb", extended: true }));
  await app.listen(await readPort());
}

bootstrap();

