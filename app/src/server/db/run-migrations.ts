import { loadEnv } from "./load-env";

loadEnv();

import { runMigrations } from "./migrate";
import { closeDb } from "./index";

runMigrations()
  .then(() => {
    console.log("[6Gate] Postgres migrations applied.");
    return closeDb();
  })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[6Gate] Migration failed:", err);
    process.exit(1);
  });
