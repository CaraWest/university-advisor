import type { Metadata } from "next";

import { ImportPageClient } from "@/components/import/import-page-client";

export const metadata: Metadata = {
  title: "Import data",
};

export default function ImportPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Import data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Merge batch JSON into SQLite — research, financial, SwimCloud (local{" "}
          <code className="rounded bg-muted px-1 text-xs">npm run swimcloud:fetch</code>), then Scorecard.
        </p>
      </div>
      <ImportPageClient />
    </div>
  );
}
