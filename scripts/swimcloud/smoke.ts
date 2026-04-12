/**
 * Verifies SwimCloud storageState. Uses Google Chrome by default (SWIMCLOUD_PLAYWRIGHT_CHANNEL=chromium to override).
 * SWIMCLOUD_HEADED=1 — headless often never paints the logged-in fit page even with valid cookies.
 */
import { existsSync } from "node:fs";

import { chromium } from "playwright";
import type { Page } from "playwright";

import { swimcloudChromiumLaunchHints } from "./chromium-launch";
import { swimcloudSmokeUrl, swimcloudStorageStatePath } from "./paths";

function useChromeChannel(): boolean {
  return process.env.SWIMCLOUD_PLAYWRIGHT_CHANNEL !== "chromium";
}

/** Same markers scrape uses — SPA may paint these after `load`. */
const FIT_PAGE_LOCATOR =
  ".js-match-score-total, .c-power-index__markers--top, .c-match-score, .c-team-size__total";

async function cloudflareInterstitial(page: Page): Promise<boolean> {
  const title = (await page.title()).trim();
  if (/^just a moment/i.test(title)) return true;
  const probe = page.locator("#cf-challenge-running, .cf-im-under-attack, #challenge-error");
  return probe
    .first()
    .isVisible()
    .catch(() => false);
}

async function fitUiVisible(page: Page): Promise<boolean> {
  const marker = page.locator(FIT_PAGE_LOCATOR).first();
  if (await marker.isVisible().catch(() => false)) return true;

  const teamMatch = page.getByRole("heading", { name: /team match/i });
  const teamStrength = page.getByRole("heading", { name: /team strength/i });
  if (await teamMatch.isVisible().catch(() => false)) return true;
  if (await teamStrength.isVisible().catch(() => false)) return true;

  return false;
}

async function main() {
  const storagePath = swimcloudStorageStatePath();
  if (!existsSync(storagePath)) {
    console.error(`No session file at ${storagePath}\nRun first: npm run swimcloud:auth\n`);
    process.exit(1);
  }

  const headed = process.env.SWIMCLOUD_HEADED === "1" || process.env.SWIMCLOUD_HEADED === "true";
  const launchOpts: Parameters<typeof chromium.launch>[0] = {
    headless: !headed,
    ...swimcloudChromiumLaunchHints(),
  };
  if (useChromeChannel()) {
    launchOpts.channel = "chrome";
  }

  const url = swimcloudSmokeUrl();
  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({
    storageState: storagePath,
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
  });
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "load", timeout: 90_000 });

  if (await cloudflareInterstitial(page)) {
    console.error(
      "Stuck on Cloudflare interstitial (“Just a moment…” / challenge).\n" +
        `URL: ${page.url()}\n` +
        "Try logged-in Chrome: SWIMCLOUD_HEADED=1 npm run swimcloud:smoke\n" +
        "If that still fails, re-save session after passing Cloudflare (npm run swimcloud:chrome-debug → swimcloud:auth:cdp).\n",
    );
    await browser.close();
    process.exit(1);
  }

  const waitMs = Math.min(60_000, Math.max(5_000, parseInt(process.env.SWIMCLOUD_SMOKE_WAIT_MS ?? "45000", 10) || 45_000));
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (await fitUiVisible(page)) break;
    await page.waitForTimeout(500);
  }

  const finalUrl = page.url();
  if (/\/login\/?/i.test(finalUrl) || /sign[\s-]?in/i.test(finalUrl)) {
    console.error(`Login URL after navigation — session expired?\n${finalUrl}\nRe-run: npm run swimcloud:auth\n`);
    await browser.close();
    process.exit(1);
  }

  const title = await page.title();
  if (/log\s*in|sign\s*in/i.test(title) && !/how\s+do\s+i\s+fit/i.test(title)) {
    console.error(`Login wall: ${title}\nRe-run: npm run swimcloud:auth\n`);
    await browser.close();
    process.exit(1);
  }

  if (!(await fitUiVisible(page))) {
    const hintHeadless =
      !headed && useChromeChannel()
        ? "Most common fix: SWIMCLOUD_HEADED=1 npm run swimcloud:smoke\n(headless Chrome often does not show the logged-in fit UI.)\n"
        : headed
          ? ""
          : "Try: SWIMCLOUD_HEADED=1 npm run swimcloud:smoke\n";
    console.error(
      "Fit page did not show Team Match / Team Strength or scrape markers (score block, power index, roster).\n" +
        `URL: ${finalUrl}\n` +
        `Waited ${waitMs}ms for content after load.\n` +
        hintHeadless +
        "Or set SWIMCLOUD_SMOKE_URL to another team how-do-i-fit URL.\n",
    );
    await browser.close();
    process.exit(1);
  }

  const totalEl = page.locator(".js-match-score-total").first();
  if ((await totalEl.count()) > 0) {
    const paid = await totalEl.getAttribute("data-paid");
    if (paid !== "true") {
      console.warn('Warning: data-paid is not "true" — subscription may be required for full fit data.\n');
    }
  }

  if (finalUrl !== url) {
    console.log(`SwimCloud smoke OK\n  requested: ${url}\n  final: ${finalUrl}\n`);
  } else {
    console.log(`SwimCloud smoke OK\n  ${url}\n`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
