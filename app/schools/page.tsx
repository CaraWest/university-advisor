import { SchoolsPageClient } from "@/components/schools/schools-page-client";

export default function SchoolsPage() {
  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Schools</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seeded list from SQLite. Data loads via <code className="rounded bg-muted px-1 py-0.5 text-xs">GET /api/schools</code>.
        </p>
      </div>
      <SchoolsPageClient />
    </div>
  );
}
