import type { Page } from "playwright";

/** Same rough markers as smoke + parse-fit — SPA may mount after load. */
const FIT_MARKERS = ".js-match-score-total, .c-power-index__markers--top, .c-match-score, .c-team-size__total";

export async function waitForFitPageMarkers(
  page: Page,
  maxMs: number = Math.max(5_000, parseInt(process.env.SWIMCLOUD_FETCH_PARSE_WAIT_MS ?? "35000", 10) || 35_000),
): Promise<void> {
  const loc = page.locator(FIT_MARKERS).first();
  const deadline = Date.now() + Math.min(120_000, maxMs);
  while (Date.now() < deadline) {
    if (await loc.isVisible().catch(() => false)) return;
    await page.waitForTimeout(400);
  }
}
