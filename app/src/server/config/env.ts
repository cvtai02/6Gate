import path from "path";
import os from "os";

const dataDir =
  process.env.DATA_DIR ||
  path.join(os.homedir(), "AppData", "Local", "6Gate");

export const env = {
  port: parseInt(process.env.PORT || "20129", 10),
  dataDir,
  dbPath: path.join(dataDir, "db", "data.sqlite"),
  uploadsDir: path.join(dataDir, "uploads", "temp"),
  logsDir: path.join(dataDir, "logs"),
  configDir: path.join(dataDir, "config"),
};
