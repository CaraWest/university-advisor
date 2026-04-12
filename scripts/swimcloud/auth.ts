/**
 * Interactive SwimCloud login using a persistent Chrome profile (helps with Cloudflare).
 * Saves Playwright storageState to SWIMCLOUD_STORAGE_STATE for headless fetch/smoke.
 *
 * If Turnstile loops forever, use real Chrome via CDP — see scripts/swimcloud/README.md § Cloudflare.
 *
 * Install Google Chrome. Optional: SWIMCLOUD_PLAYWRIGHT_CHANNEL=chromium for bundled browser only.
 */
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { chromium } from "playwright";

import { swimcloudChromiumLaunchHints } from "./chromium-launch";
import { swimcloudBrowserProfilePath, swimcloudStorageStatePath } from "./paths";

async function waitForEnter(message: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) => {
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

function useChromeChannel(): boolean {
  return process.env.SWIMCLOUD_PLAYWRIGHT_CHANNEL !== "chromium";
}

async function assertDevToolsReachable(cdpBaseUrl: string): Promise<void> {
  const base = cdpBaseUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/json/version`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch {
    console.error(
      `Cannot reach Chrome DevTools at ${base}.\n\n` +
        "Start Chrome with debugging first (from the repo root):\n" +
        "  npm run swimcloud:chrome-debug\n\n" +
        "Then log in to SwimCloud in that window and run this again.\n" +
        "If you use a custom port: SWIMCLOUD_CDP_PORT=9230 npm run swimcloud:chrome-debug\n",
    );
    process.exit(1);
  }
}

async function main() {
  const storagePath = swimcloudStorageStatePath();
  await mkdir(dirname(storagePath), { recursive: true });

  const cdpUrl = process.env.SWIMCLOUD_CDP_URL?.trim();
  if (cdpUrl) {
    await assertDevToolsReachable(cdpUrl);
    console.log(
      `Connecting to existing Chrome at ${cdpUrl}\n` +
        "(real Chrome you opened — not Playwright; use when Cloudflare never clears).\n",
    );
    const browser = await chromium.connectOverCDP(cdpUrl);
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      console.error("No browser contexts found — keep at least one tab open in that Chrome instance.\n");
      await browser.close();
      process.exit(1);
    }
    const context = contexts[0];
    console.log(
      "\n1. In that Chrome window, open https://www.swimcloud.com/ and finish Cloudflare + log in.\n" +
        "2. Press Enter here to save cookies.\n",
    );
    await waitForEnter("Press Enter after you are logged in… ");
    await context.storageState({ path: storagePath });
    await browser.close();
    console.log(`Saved session to ${storagePath}\nRun: npm run swimcloud:smoke | npm run swimcloud:fetch\n`);
    return;
  }

  const profileDir = swimcloudBrowserProfilePath();
  await mkdir(profileDir, { recursive: true });

  const launchOpts: Parameters<typeof chromium.launchPersistentContext>[1] = {
    headless: false,
    // Full window size looks less like a fixed bot viewport; Cloudflare is stricter with 720p-only windows.
    viewport: null,
    locale: "en-US",
    ...swimcloudChromiumLaunchHints(),
  };
  if (useChromeChannel()) {
    launchOpts.channel = "chrome";
  }

  console.log(
    useChromeChannel()
      ? "Using Google Chrome (channel: chrome). Set SWIMCLOUD_PLAYWRIGHT_CHANNEL=chromium to use Playwright Chromium.\n" +
          "If Cloudflare never finishes here, stop (Ctrl+C) and use:\n" +
          "  Terminal 1: npm run swimcloud:chrome-debug\n" +
          "  Terminal 2: npm run swimcloud:auth:cdp\n"
      : "Using Playwright Chromium.\n",
  );

  const context = await chromium.launchPersistentContext(profileDir, launchOpts);
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto("https://www.swimcloud.com/", { waitUntil: "domcontentloaded" });

  console.log(
    "\n1. In the browser, complete any Cloudflare check and log in to SwimCloud.\n" +
      "2. If the Cloudflare box keeps reappearing, stop (Ctrl+C) and use SWIMCLOUD_CDP_URL — see scripts/swimcloud/README.md.\n" +
      "3. Press Enter here to save cookies to storageState.\n",
  );

  await waitForEnter("Press Enter after you are logged in… ");

  await context.storageState({ path: storagePath });
  await context.close();

  console.log(`Saved session to ${storagePath}\nProfile: ${profileDir}\nRun: npm run swimcloud:smoke | npm run swimcloud:fetch\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
