import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthSession } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

const SCORECARD_BASE =
  "https://api.data.gov/ed/collegescorecard/v1/schools.json";

const SEARCH_FIELDS = [
  "id",
  "school.name",
  "school.city",
  "school.state",
  "location.lat",
  "location.lon",
  "school.ownership",
].join(",");

type ScorecardRow = Record<string, unknown>;

export type ScorecardSearchResult = {
  scorecardId: number;
  name: string;
  city: string | null;
  state: string;
  latitude: number | null;
  longitude: number | null;
  ownership: number;
  alreadyExists: boolean;
  existingId: string | null;
};

export async function GET(request: Request) {
  const auth = await requireAuthSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.SCORECARD_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "SCORECARD_API_KEY not configured" },
      { status: 500 },
    );
  }

  const url = new URL(SCORECARD_BASE);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("school.name", q);
  url.searchParams.set("fields", SEARCH_FIELDS);
  url.searchParams.set("per_page", "10");

  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json(
      { error: `Scorecard API error (${res.status})` },
      { status: 502 },
    );
  }

  const data = (await res.json()) as { results?: ScorecardRow[] };
  const rows = data.results ?? [];

  const scorecardIds = rows
    .map((r) => (typeof r.id === "number" ? r.id : null))
    .filter((id): id is number => id !== null);

  const existing = scorecardIds.length
    ? await prisma.school.findMany({
        where: { scorecardId: { in: scorecardIds } },
        select: { id: true, scorecardId: true },
      }).then(schools =>
        schools.map(s => ({
          id: s.id,
          scorecardId: s.scorecardId,
        }))
      )
    : [];

  const existingMap = new Map(
    existing.map((e) => [e.scorecardId!, e.id]),
  );

  const results: ScorecardSearchResult[] = rows.map((r) => {
    const scId = typeof r.id === "number" ? r.id : 0;
    const existingId = existingMap.get(scId) ?? null;
    return {
      scorecardId: scId,
      name: String(r["school.name"] ?? ""),
      city: r["school.city"] != null ? String(r["school.city"]) : null,
      state: String(r["school.state"] ?? ""),
      latitude:
        typeof r["location.lat"] === "number" ? r["location.lat"] : null,
      longitude:
        typeof r["location.lon"] === "number" ? r["location.lon"] : null,
      ownership: typeof r["school.ownership"] === "number" ? r["school.ownership"] : 0,
      alreadyExists: existingId !== null,
      existingId,
    };
  });

  return NextResponse.json({ results });
}
