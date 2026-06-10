import path from "path";
import os from "os";

const dataDir = path.join(os.homedir(), "AppData", "Local", "6Gate");

export const env = {
  port: 20130,
  systemSecret: process.env.SYSTEM_SECRET || "changeme",
  dataDir,
  dbPath: path.join(dataDir, "db", "data.sqlite"),
  uploadsDir: path.join(dataDir, "uploads", "temp"),
  logsDir: path.join(dataDir, "logs"),
  configDir: path.join(dataDir, "config"),
};
