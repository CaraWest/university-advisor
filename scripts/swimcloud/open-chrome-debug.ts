/**
 * Starts Google Chrome with a dedicated profile and remote debugging so you can pass Cloudflare
 * in a normal browser session, then run npm run swimcloud:auth:cdp.
 *
 * Override executable: CHROME_PATH=/path/to/chrome
 * Override port: SWIMCLOUD_CDP_PORT=9222
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { platform } from "node:os";
import { join } from "node:path";

function defaultChromePath(): string {
  const env = process.env.CHROME_PATH?.trim();
  if (env && existsSync(env)) return env;

  const os = platform();
  if (os === "darwin") {
    const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (!existsSync(mac)) {
      console.error(
        "Google Chrome not found at /Applications/Google Chrome.app/Contents/MacOS/Google Chrome.\n" +
          "Install Chrome or set CHROME_PATH to your chrome binary.\n",
      );
      process.exit(1);
    }
    return mac;
  }

  if (os === "win32") {
    const candidates = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
    console.error("Google Chrome not found. Install Chrome or set CHROME_PATH.\n");
    process.exit(1);
  }

  const linux = ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome", "/snap/bin/chromium"];
  for (const p of linux) {
    if (existsSync(p)) return p;
  }
  console.error(
    "Could not find Chrome under common Linux paths. Install google-chrome-stable or set CHROME_PATH.\n",
  );
  process.exit(1);
}

async function main() {
  const port = process.env.SWIMCLOUD_CDP_PORT?.trim() || "9222";
  const userDataDir = join(process.cwd(), ".local", "swimcloud-chrome-cdp");
  await mkdir(join(process.cwd(), ".local"), { recursive: true });

  const exe = defaultChromePath();
  const child = spawn(
    exe,
    [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, "https://www.swimcloud.com/"],
    { detached: true, stdio: "ignore" },
  );
  child.unref();

  console.log(
    `Started Chrome with DevTools on port ${port}.\n` +
      `Profile (gitignored): ${userDataDir}\n\n` +
      `1. In that window, finish Cloudflare and log in to SwimCloud (use a normal tab, not Incognito).\n` +
      `2. In another terminal: npm run swimcloud:auth:cdp\n` +
      `   (or SWIMCLOUD_CDP_URL=http://127.0.0.1:${port} npm run swimcloud:auth)\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
