import { existsSync, readdirSync, readFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  console.error("[db:restore] Only for SQLite (DATABASE_URL=file:…). Use Supabase backups or pg_dump for PostgreSQL.");
  process.exit(1);
}

if (!existsSync(BACKUPS_DIR)) {
  console.error("[db:restore] No backups directory found at prisma/backups/");
  process.exit(1);
}

const backups = readdirSync(BACKUPS_DIR)
  .filter((f) => f.startsWith("dev.") && f.endsWith(".db"))
  .sort()
  .reverse();

if (backups.length === 0) {
  console.error("[db:restore] No backup files found in prisma/backups/");
  process.exit(1);
}

const arg = process.argv[2];

if (!arg) {
  console.log("Available backups (newest first):\n");
  backups.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  console.log(
    `\nUsage:  npm run db:restore -- <number>\n` +
      `   e.g. npm run db:restore -- 1    (restores the most recent backup)`,
  );
  process.exit(0);
}

const index = parseInt(arg, 10);
if (isNaN(index) || index < 1 || index > backups.length) {
  console.error(
    `[db:restore] Invalid selection "${arg}". Pick a number between 1 and ${backups.length}.`,
  );
  process.exit(1);
}

const chosen = backups[index - 1];
const src = join(BACKUPS_DIR, chosen);

copyFileSync(src, DB_PATH);
console.log(`[db:restore] Restored ${chosen} → ${DB_PATH}`);
