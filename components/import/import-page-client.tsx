"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function SourceResult({ name, value }: { name: string; value: unknown }) {
  if (value === undefined) return null;
  if (typeof value === "string") {
    return (
      <li>
        <span className="font-medium text-foreground">{name}:</span> {value}
      </li>
    );
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return (
      <li>
        <span className="font-medium text-foreground">{name}:</span> {String(value)}
      </li>
    );
  }
  if (isRecord(value) && "skipped" in value && value.skipped === "no_import_file") {
    return (
      <li>
        <span className="font-medium text-foreground">{name}:</span>{" "}
        <span className="text-muted-foreground">no matching JSON files in data/imports/</span>
      </li>
    );
  }
  if (isRecord(value) && value.ok === true) {
    const processed = value.processed;
    const skipped = value.skipped;
    const messages = value.messages;
    const fileErrors = value.fileErrors;
    const paths = value.paths;
    return (
      <li className="space-y-1">
        <span className="font-medium text-foreground">{name}</span>
        <ul className="ml-4 list-disc text-muted-foreground">
          {typeof processed === "number" ? <li>Processed: {processed}</li> : null}
          {typeof skipped === "number" ? <li>Skipped (unknown school / validation): {skipped}</li> : null}
          {Array.isArray(messages) && messages.length > 0 ? (
            <li>
              Messages:{" "}
              <span className="whitespace-pre-wrap">{messages.join("; ")}</span>
            </li>
          ) : null}
          {Array.isArray(paths) ? (
            <li className="break-all text-xs">Files: {paths.map((p) => String(p)).join(", ")}</li>
          ) : null}
          {Array.isArray(fileErrors) && fileErrors.length > 0 ? (
            <li className="text-destructive">
              File errors: {fileErrors.length} — see raw JSON below for details
            </li>
          ) : null}
        </ul>
      </li>
    );
  }
  if (isRecord(value) && value.error === "no_valid_files") {
    const fe = value.fileErrors;
    return (
      <li className="space-y-1">
        <span className="font-medium text-destructive">{name}: no valid files</span>
        {Array.isArray(fe) && fe.length > 0 ? (
          <pre className="max-h-40 overflow-auto rounded border bg-muted/40 p-2 text-xs">{JSON.stringify(fe, null, 2)}</pre>
        ) : null}
      </li>
    );
  }
  if (isRecord(value)) {
    return (
      <li className="space-y-1">
        <span className="font-medium text-foreground">{name}</span>
        <pre className="max-h-48 overflow-auto rounded border bg-muted/40 p-2 text-xs">{JSON.stringify(value, null, 2)}</pre>
      </li>
    );
  }
  return (
    <li>
      <span className="font-medium text-foreground">{name}:</span> {String(value)}
    </li>
  );
}

export function ImportPageClient() {
  const [result, setResult] = React.useState<Record<string, unknown> | null>(null);
  const [running, setRunning] = React.useState(false);

  const runImport = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/import", { method: "POST" });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`Import request failed (${res.status})`);
        setResult(isRecord(data) ? data : { error: "invalid_response" });
        return;
      }
      if (!isRecord(data)) {
        toast.error("Invalid response from server");
        return;
      }
      setResult(data);
      const hasErrors = Object.values(data).some((v) => {
        if (!isRecord(v)) return false;
        return v.error != null || (Array.isArray(v.fileErrors) && v.fileErrors.length > 0);
      });
      if (hasErrors) {
        toast.warning("Import finished with some errors — review the summary below.");
      } else {
        toast.success("Import run completed.");
      }
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setRunning(false);
    }
  };

  const ORDER = ["school_research", "financial", "swimcloud", "scorecard"];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Run file imports</CardTitle>
          <CardDescription>
            Merges batch JSON under <code className="rounded bg-muted px-1 text-xs">data/imports/</code> (research, financial, SwimCloud
            fetch, scorecard — see{" "}
            <code className="rounded bg-muted px-1 text-xs">data/imports/README.md</code>
            ). Safe to re-run; newer files win per the import contract. SwimCloud fit data:{" "}
            <code className="rounded bg-muted px-1 text-xs">npm run swimcloud:fetch</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button disabled={running} onClick={() => void runImport()}>
            {running ? "Running…" : "Run import"}
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            CLI (same merge as this button):{" "}
            <code className="rounded bg-muted px-1">npm run import:run</code>
            {" · "}
            HTTP: <code className="rounded bg-muted px-1">curl -X POST http://localhost:3000/api/import</code> (dev server).
          </p>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last run summary</CardTitle>
            <CardDescription>Per-source outcome in pipeline order.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3 text-sm">
              {ORDER.filter((k) => k in result).map((k) => (
                <SourceResult key={k} name={k} value={result[k]} />
              ))}
            </ul>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Raw JSON response</summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
