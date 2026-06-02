import { RuntimeSettingDto } from "@sixgate/api-client";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";
import { env } from "@/server/config/env";

export const DEFAULT_SETTINGS: Record<string, string> = {
  port: String(env.port),
  dataDir: env.dataDir,
  dbPath: env.dbPath,
  uploadsDir: env.uploadsDir,
  logsDir: env.logsDir,
  configDir: env.configDir,
  settingsPath: env.settingsPath,
  zernioBaseUrl: "https://zernio.com/api/v1",
};

export type SettingsFile = Record<string, RuntimeSettingDto>;

export async function readSettings(): Promise<SettingsFile> {
  try {
    const raw = await readFile(env.settingsPath, "utf8");
    const parsed = JSON.parse(raw) as SettingsFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return {};
    throw err;
  }
}

export async function writeSettings(settings: SettingsFile) {
  await mkdir(dirname(env.settingsPath), { recursive: true });
  await writeFile(env.settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}
