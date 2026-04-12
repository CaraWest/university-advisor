"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";

import { invalidateSchoolStatusCounts } from "@/lib/school-status-counts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SearchResult = {
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

export function AddSchoolDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [selected, setSelected] = React.useState<SearchResult | null>(null);
  const [swimcloudUrl, setSwimcloudUrl] = React.useState("");
  const abortRef = React.useRef<AbortController | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSearching(false);
      setAdding(false);
      setSelected(null);
      setSwimcloudUrl("");
    }
  }, [open]);

  const search = React.useCallback((q: string) => {
    abortRef.current?.abort();

    if (q.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/api/schools/search?q=${encodeURIComponent(q.trim())}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("School search error:", err);
        setResults([]);
      })
      .finally(() => setSearching(false));
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (result: SearchResult) => {
    if (result.alreadyExists && result.existingId) {
      onOpenChange(false);
      router.push(`/schools/${result.existingId}`);
      return;
    }
    setSelected(result);
    setSwimcloudUrl("");
  };

  const handleConfirm = async () => {
    if (!selected) return;
    setAdding(true);

    const trimmed = swimcloudUrl.trim();

    try {
      const res = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selected.name,
          state: selected.state,
          city: selected.city,
          scorecardId: selected.scorecardId,
          latitude: selected.latitude,
          longitude: selected.longitude,
          ownership: selected.ownership,
          ...(trimmed ? { swimcloudUrl: trimmed } : {}),
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(String(data.error ?? `Create failed (${res.status})`));
      }

      const { id } = (await res.json()) as { id: string };

      fetch(`/api/enrich/${id}`, { method: "POST" }).catch(() => {});

      toast.success("School added — enrichment running in background");
      invalidateSchoolStatusCounts();
      onOpenChange(false);
      router.push(`/schools/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add school");
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {selected ? (
          <>
            <DialogHeader>
              <DialogTitle>Confirm school</DialogTitle>
              <DialogDescription>
                Review and optionally add the SwimCloud URL for scraping.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-md border px-3 py-2.5">
              <p className="text-sm font-medium">{selected.name}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0" />
                {selected.city ? `${selected.city}, ` : ""}
                {selected.state}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="swimcloud-url">SwimCloud URL (optional)</Label>
              <Input
                id="swimcloud-url"
                placeholder="https://www.swimcloud.com/team/123/"
                value={swimcloudUrl}
                onChange={(e) => setSwimcloudUrl(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Provide the team page URL so the school is included in future swim data scrapes.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(null)}
                disabled={adding}
              >
                <ArrowLeft className="mr-1 size-3.5" />
                Back
              </Button>
              <Button onClick={() => void handleConfirm()} disabled={adding}>
                {adding && <Loader2 className="mr-2 size-4 animate-spin" />}
                Add School
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add school</DialogTitle>
              <DialogDescription>
                Search by name to find a school in the College Scorecard database.
              </DialogDescription>
            </DialogHeader>

            <Input
              placeholder="Search schools…"
              value={query}
              onChange={handleInputChange}
              autoFocus
            />

            <div className="max-h-64 min-h-[4rem] overflow-y-auto rounded-md border">
              {searching ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Searching…
                </div>
              ) : results.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {query.trim().length >= 2
                    ? "No results found."
                    : "Type at least 2 characters to search."}
                </div>
              ) : (
                <ul className="divide-y">
                  {results.map((r) => (
                    <li key={r.scorecardId}>
                      <Button
                        variant="ghost"
                        className="h-auto w-full justify-start rounded-none px-3 py-2.5 text-left"
                        onClick={() => handleSelect(r)}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium">
                            {r.name}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3 shrink-0" />
                            {r.city ? `${r.city}, ` : ""}
                            {r.state}
                          </span>
                        </div>
                        <span className="ml-2 shrink-0">
                          {r.alreadyExists ? (
                            <span className="text-xs text-muted-foreground">View →</span>
                          ) : (
                            <Plus className="size-4 text-muted-foreground" />
                          )}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
