import fs from "fs";
import { env } from "@/server/config/env";

export function ensureDataDirs() {
  fs.mkdirSync(env.uploadsDir, { recursive: true });
  fs.mkdirSync(env.logsDir, { recursive: true });
  fs.mkdirSync(env.configDir, { recursive: true });
}
