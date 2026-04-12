/**
 * Extract fields from SwimCloud "How do I fit" HTML into import-envelope swimcloud row keys.
 * See docs/context/swimcloud_scrape_spec.md for selector semantics.
 */
import type { Page } from "playwright";

function parseMoneyRough(text: string): number | undefined {
  const m = text.replace(/,/g, "").match(/\$(\d+)/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : undefined;
}

export async function parseHowDoIFitPage(
  page: Page,
  teamId: number,
  schoolName: string,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    name: schoolName,
    hasSwimTeam: true,
    swimcloudUrl: `https://www.swimcloud.com/team/${teamId}/`,
    scrapeTeamId: teamId,
    scrapePage: "how-do-i-fit",
  };

  const topPi = page.locator(".c-power-index__markers--top .c-power-index__badge .c-title").first();
  if ((await topPi.count()) > 0) {
    const t = (await topPi.textContent())?.trim();
    const n = t ? parseFloat(t) : NaN;
    if (Number.isFinite(n)) out.teamPowerIndexAvg = n;
  }

  const rosterTotal = page.locator(".c-team-size__total").first();
  if ((await rosterTotal.count()) > 0) {
    const t = (await rosterTotal.textContent())?.trim();
    const n = t ? parseInt(t, 10) : NaN;
    if (Number.isFinite(n)) out.rosterSize = n;
  }

  const seniorLegend = page.locator(".c-team-size__legend-item").filter({ hasText: /Senior\s*\(/ });
  if ((await seniorLegend.count()) > 0) {
    const text = (await seniorLegend.first().textContent()) ?? "";
    const m = text.match(/Senior\s*\((\d+)\)/);
    if (m) out.seniorsGraduating = parseInt(m[1], 10);
  }

  const matchTotal = page.locator(".js-match-score-total").first();
  if ((await matchTotal.count()) > 0) {
    const sc = await matchTotal.getAttribute("data-score");
    if (sc != null) {
      const n = parseInt(sc, 10);
      if (Number.isFinite(n)) out.matchScore = n;
    }
  }

  const swimText = page.locator(".c-match-score__item:has(.fa-swimmer) .c-match-score__text").first();
  if ((await swimText.count()) > 0) {
    const tx = ((await swimText.textContent()) ?? "").trim();
    const rankM = tx.match(/^(\d+)(?:st|nd|rd|th)\s+in\s+(.+)$/i);
    if (rankM) {
      out.abigailRank = parseInt(rankM[1], 10);
      out.athleteEvent = rankM[2].trim();
      // Team Match swim factor line = team-relative depth, not conference standings.
      out.eventDepthRankScope = "team";
    }
  }

  const allFactorTexts = page.locator(".c-match-score__item .c-match-score__text");
  const nText = await allFactorTexts.count();
  for (let i = 0; i < nText; i++) {
    const tx = ((await allFactorTexts.nth(i).textContent()) ?? "").trim();
    const dm = tx.match(/(\d+)\s*mi\s+from/i);
    if (dm) {
      out.distanceMiles = parseInt(dm[1], 10);
      break;
    }
  }
  for (let i = 0; i < nText; i++) {
    const tx = ((await allFactorTexts.nth(i).textContent()) ?? "").trim();
    if (/\$\d/.test(tx) && /average net cost/i.test(tx)) {
      const cost = parseMoneyRough(tx);
      if (cost != null) out.avgNetCost = cost;
      break;
    }
  }

  const toolbarLinks = page.locator(".c-toolbar__meta .o-list-inline--dotted > li > a").filter({
    hasNot: page.locator("..").locator("ul.o-list-inline li ul"),
  });
  const firstRow = page.locator(".c-toolbar__meta .o-list-inline--dotted > li").first();
  const linkCount = await firstRow.locator("> a").count();
  if (linkCount >= 1) {
    const d = await firstRow.locator("> a").nth(0).textContent();
    if (d?.trim()) out.ncaaDivision = d.trim();
  }
  const liLinks = page.locator(".c-toolbar__meta .o-list-inline--dotted > li > a[href*='/division/']");
  const confLinks = page.locator(".c-toolbar__meta .o-list-inline--dotted > li > a[href*='/conference/']");
  if ((await liLinks.count()) > 0) {
    const d = (await liLinks.first().textContent())?.trim();
    if (d) out.ncaaDivision = d;
  }
  if ((await confLinks.count()) > 0) {
    const c = (await confLinks.first().textContent())?.trim();
    if (c) out.conference = c;
  }

  const rankHeading = page.getByRole("heading", { name: "Team Ranking" });
  if (await rankHeading.isVisible().catch(() => false)) {
    const section = page.locator("section.rf-section").filter({ has: rankHeading }).first();
    const d3block = section.locator(".u-flex").filter({ hasText: "Division 3" }).first();
    if ((await d3block.count()) > 0) {
      const rankA = d3block.locator("a.u-text-bold").first();
      const small = d3block.locator(".u-text-small").first();
      if ((await rankA.count()) > 0) {
        const r = (await rankA.textContent())?.trim();
        const smallTxt = (await small.textContent())?.trim() ?? "";
        const totalM = smallTxt.match(/\/\s*(\d+)/);
        if (r && totalM) out.teamRankDisplay = `${r} in Div 3 (${totalM[1]} teams)`;
        else if (r) out.teamRankDisplay = `${r} in Div 3`;
      }
    }
  }

  return out;
}
