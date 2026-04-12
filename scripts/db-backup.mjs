import { existsSync, copyFileSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BACKUPS = 10;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = join(root, "prisma", "dev.db");
const BACKUPS_DIR = join(root, "prisma", "backups");

function databaseUrlFromEnv() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return "";
  const line = readFileSync(envPath, "utf8").split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) return "";
  const v = line.slice("DATABASE_URL=".length).trim();
  return v.replace(/^["']|["']$/g, "");
}

const dbUrl = databaseUrlFromEnv();
if (dbUrl && !dbUrl.startsWith("file:")) {
  console.log("[db:backup] DATABASE_URL is not SQLite (file:…) — skipping local .db backup.");
  process.exit(0);
}

if (!existsSync(DB_PATH)) {
  console.log("[db:backup] No database file found — nothing to back up.");
  process.exit(0);
}

mkdirSync(BACKUPS_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = join(BACKUPS_DIR, `dev.${stamp}.db`);
copyFileSync(DB_PATH, dest);
console.log(`[db:backup] ${dest}`);

const backups = readdirSync(BACKUPS_DIR)
  .filter((f) => f.startsWith("dev.") && f.endsWith(".db"))
  .sort()
  .reverse();

if (backups.length > MAX_BACKUPS) {
  for (const old of backups.slice(MAX_BACKUPS)) {
    unlinkSync(join(BACKUPS_DIR, old));
    console.log(`[db:backup] pruned ${old}`);
  }
}
