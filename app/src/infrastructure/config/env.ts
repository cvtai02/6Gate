import path from "path";
import os from "os";

const dataDir = path.join(os.homedir(), "AppData", "Local", "6Gate");

export const env = {
  port: 20130,
  // Auth: login secret + JWT signing.
  systemSecret: process.env.SYSTEM_SECRET || "changeme",
  // Encryption-at-rest key for sensitive values (AES-256-GCM). Must stay constant
  // across deploys or previously-encrypted DB values won't decrypt.
  encryptionKey: process.env.ENCRYPTION_KEY || "changeme",
  dataDir,
  dbPath: path.join(dataDir, "db", "data.sqlite"),
  uploadsDir: path.join(dataDir, "uploads", "temp"),
  logsDir: path.join(dataDir, "logs"),
  configDir: path.join(dataDir, "config"),
};
