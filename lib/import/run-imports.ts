import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";

import {
  applyFinancialImport,
  applyResearchImport,
  applyScorecardImport,
  applySwimcloudImport,
} from "@/lib/import/apply-school-imports";
import {
  schoolImportEnvelopeSchema,
  type SchoolImportEnvelope,
} from "@/lib/validation/import-envelope";

const PREFIX_BY_SOURCE = {
  swimcloud: "swimcloud_",
  school_research: "research_",
  financial: "financial_",
  scorecard: "scorecard_",
} as const;

type Source = keyof typeof PREFIX_BY_SOURCE;

async function jsonFilesForPrefixSorted(
  importsDir: string,
  prefix: string,
): Promise<{ path: string; mtime: number }[]> {
  let names: string[];
  try {
    names = await readdir(importsDir);
  } catch {
    return [];
  }
  const scored: { path: string; mtime: number }[] = [];
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith(".json")) continue;
    const p = join(importsDir, name);
    try {
      const st = await stat(p);
      scored.push({ path: p, mtime: st.mtimeMs });
    } catch {
      continue;
    }
  }
  scored.sort((a, b) => a.mtime - b.mtime);
  return scored;
}

/**
 * Processes all import files per source in the given directory, merged in mtime
 * ascending order. Apply order: school_research -> financial -> swimcloud -> scorecard.
 */
export async function runImportPipeline(
  prisma: PrismaClient,
  importsDir: string,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};

  const order: Source[] = ["school_research", "financial", "swimcloud", "scorecard"];

  for (const source of order) {
    const prefix = PREFIX_BY_SOURCE[source];
    const files = await jsonFilesForPrefixSorted(importsDir, prefix);
    if (files.length === 0) {
      out[source] = { skipped: "no_import_file" };
      continue;
    }

    const fileErrors: Record<string, unknown>[] = [];
    const entries: { path: string; mtime: number; data: SchoolImportEnvelope }[] = [];

    for (const f of files) {
      let raw: unknown;
      try {
        raw = JSON.parse(await readFile(f.path, "utf8"));
      } catch (e) {
        fileErrors.push({ path: f.path, error: "invalid_json", detail: String(e) });
        continue;
      }
      const parsed = schoolImportEnvelopeSchema.safeParse(raw);
      if (!parsed.success) {
        fileErrors.push({ path: f.path, error: "validation_failed", zod: parsed.error.flatten() });
        continue;
      }
      const data = parsed.data;
      if (data.source !== source) {
        fileErrors.push({ path: f.path, error: "source_mismatch", fileSource: data.source, expectedSource: source });
        continue;
      }
      entries.push({ path: f.path, mtime: f.mtime, data });
    }

    if (entries.length === 0) {
      out[source] = { error: "no_valid_files", fileErrors };
      continue;
    }

    const paths = entries.map((e) => e.path);
    const collectedAt = entries.reduce(
      (best, e) => (e.mtime > best.mtime ? { mtime: e.mtime, at: e.data.collectedAt } : best),
      { mtime: -Infinity, at: entries[0].data.collectedAt },
    ).at;

    try {
      let result;
      if (source === "swimcloud") {
        const schools = entries.flatMap(
          (e) => (e.data as Extract<SchoolImportEnvelope, { source: "swimcloud" }>).schools,
        );
        result = await applySwimcloudImport(prisma, schools, collectedAt);
      } else if (source === "school_research") {
        const schools = entries.flatMap(
          (e) => (e.data as Extract<SchoolImportEnvelope, { source: "school_research" }>).schools,
        );
        result = await applyResearchImport(prisma, schools);
      } else if (source === "financial") {
        const schools = entries.flatMap(
          (e) => (e.data as Extract<SchoolImportEnvelope, { source: "financial" }>).schools,
        );
        result = await applyFinancialImport(prisma, schools);
      } else if (source === "scorecard") {
        const schools = entries.flatMap(
          (e) => (e.data as Extract<SchoolImportEnvelope, { source: "scorecard" }>).schools,
        );
        result = await applyScorecardImport(prisma, schools);
      } else {
        continue;
      }
      out[source] = {
        ok: true,
        paths,
        filesMerged: paths.length,
        ...result,
        ...(fileErrors.length > 0 ? { fileErrors } : {}),
      };
    } catch (e) {
      out[source] = { error: "apply_failed", paths, detail: String(e) };
    }
  }

  return out;
}
