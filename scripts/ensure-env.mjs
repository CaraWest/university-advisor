import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const examplePath = join(root, ".env.example");

if (existsSync(envPath)) {
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.error("Missing .env and .env.example — create .env with DATABASE_URL set.");
  process.exit(1);
}

copyFileSync(examplePath, envPath);
console.log("Created .env from .env.example (add secrets here; .env is gitignored).");
