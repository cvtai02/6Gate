import { readFileSync } from "fs";
import { join } from "path";

/**
 * Minimal .env loader for standalone scripts (migration runner, SQLite importer).
 * Mirrors the bootstrap loader in main.ts: sets a var only if not already in the
 * shell environment. The NestJS app does this itself; scripts call this directly.
 */
export function loadEnv(cwd = process.cwd()) {
  try {
    const lines = readFileSync(join(cwd, ".env"), "utf8").split("\n");
    for (const line of lines) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* no .env — rely on shell environment */
  }
}
