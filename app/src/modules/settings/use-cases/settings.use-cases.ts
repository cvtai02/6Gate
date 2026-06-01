import { Injectable, OnModuleInit } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { RuntimeSettingDto } from "@sixgate/api-client";
import { env } from "@/server/config/env";
import { getDb } from "@/server/db";
import { settings } from "@/server/db/schema";

const DEFAULTS: Record<string, string> = {
  port: String(env.port),
  dataDir: env.dataDir,
  dbPath: env.dbPath,
  uploadsDir: env.uploadsDir,
  logsDir: env.logsDir,
  configDir: env.configDir,
  zernioBaseUrl: "https://zernio.com/api/v1",
};

@Injectable()
export class SettingsUseCases implements OnModuleInit {
  async onModuleInit() {
    await this.bootstrapDefaults();
  }

  async bootstrapDefaults() {
    const db = getDb();
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(DEFAULTS)) {
      const existing = await db.select().from(settings).where(eq(settings.key, key)).get();
      if (!existing) {
        await db.insert(settings).values({ key, value, updatedAt: now });
      }
    }
  }

  async list(): Promise<RuntimeSettingDto[]> {
    await this.bootstrapDefaults();
    return getDb().select().from(settings).all();
  }

  async update(key: string, value: string): Promise<RuntimeSettingDto> {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = await db.select().from(settings).where(eq(settings.key, key)).get();
    if (existing) {
      await db.update(settings).set({ value, updatedAt: now }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value, updatedAt: now });
    }
    return (await db.select().from(settings).where(eq(settings.key, key)).get())!;
  }
}

