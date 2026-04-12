"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  DIVISION_PREFERENCES,
  SIZE_PREFERENCES,
} from "@/lib/validation/student-profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

interface ProfileData {
  powerIndex?: number | null;
  satMath?: number | null;
  satEBRW?: number | null;
  satComposite?: number | null;
  gpa?: number | null;
  graduationYear?: number | null;
  studyAbroadInterest?: boolean;
  divisionPreference?: string | null;
  sizePreference?: string | null;
  geographyNotes?: string | null;
  writingProfile?: string | null;
  studyAbroadProfile?: string | null;
}

const UNSET = "__unset__";

function formatApiError(data: unknown): string {
  if (typeof data === "object" && data !== null && "issues" in data) {
    const issues = (data as {
      issues?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    }).issues;
    const lines = [...(issues?.formErrors ?? [])];
    for (const [k, v] of Object.entries(issues?.fieldErrors ?? {})) {
      if (Array.isArray(v) && v.length) lines.push(`${k}: ${v.join(", ")}`);
    }
    if (lines.length) return lines.join("; ");
  }
  if (typeof data === "object" && data !== null && "error" in data) {
    return String((data as { error: unknown }).error);
  }
  return "Something went wrong";
}

function parseOptionalFloat(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

/** First sentence for preview: text through the first period, or full text if none. */
function firstSentencePreview(text: string): string {
  const trimmed = text.trim();
  const i = trimmed.indexOf(".");
  if (i === -1) return trimmed;
  return trimmed.slice(0, i + 1);
}

function ProfileSkeleton() {
  return (
    <div className="max-w-2xl space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: i === 1 ? 4 : i === 2 ? 4 : 1 }).map((_, j) => (
              <div key={j} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ProfilePageClient() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [powerIndex, setPowerIndex] = React.useState("");
  const [satMath, setSatMath] = React.useState("");
  const [satEBRW, setSatEBRW] = React.useState("");
  const [satComposite, setSatComposite] = React.useState("");
  const [gpa, setGpa] = React.useState("");
  const [graduationYear, setGraduationYear] = React.useState("");
  const [studyAbroadInterest, setStudyAbroadInterest] = React.useState(true);
  const [divisionPreference, setDivisionPreference] = React.useState<string>(UNSET);
  const [sizePreference, setSizePreference] = React.useState<string>(UNSET);
  const [geographyNotes, setGeographyNotes] = React.useState("");
  const [writingProfile, setWritingProfile] = React.useState<string | null>(null);
  const [studyAbroadProfile, setStudyAbroadProfile] =
    React.useState<string | null>(null);

  const populate = React.useCallback((data: ProfileData) => {
    setPowerIndex(data.powerIndex != null ? String(data.powerIndex) : "");
    setSatMath(data.satMath != null ? String(data.satMath) : "");
    setSatEBRW(data.satEBRW != null ? String(data.satEBRW) : "");
    setSatComposite(data.satComposite != null ? String(data.satComposite) : "");
    setGpa(data.gpa != null ? String(data.gpa) : "");
    setGraduationYear(data.graduationYear != null ? String(data.graduationYear) : "");
    setStudyAbroadInterest(data.studyAbroadInterest ?? true);
    setDivisionPreference(data.divisionPreference ?? UNSET);
    setSizePreference(data.sizePreference ?? UNSET);
    setGeographyNotes(data.geographyNotes ?? "");
    setWritingProfile(data.writingProfile ?? null);
    setStudyAbroadProfile(data.studyAbroadProfile ?? null);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/profile");
        const data: ProfileData = await res.json();
        if (!cancelled) populate(data);
      } catch {
        toast.error("Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [populate]);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        powerIndex: parseOptionalFloat(powerIndex),
        satMath: parseOptionalInt(satMath),
        satEBRW: parseOptionalInt(satEBRW),
        satComposite: parseOptionalInt(satComposite),
        gpa: parseOptionalFloat(gpa),
        graduationYear: parseOptionalInt(graduationYear),
        studyAbroadInterest,
        divisionPreference: divisionPreference === UNSET ? null : divisionPreference,
        sizePreference: sizePreference === UNSET ? null : sizePreference,
        geographyNotes: geographyNotes.trim() || null,
      };

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = formatApiError(data);
        toast.error(msg);
        return;
      }
      populate(data as ProfileData);
      toast.success("Profile saved.");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ProfileSkeleton />;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Swimming */}
      <Card>
        <CardHeader>
          <CardTitle>Swimming</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="powerIndex">Power Index</Label>
            <Input
              id="powerIndex"
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 85.4"
              value={powerIndex}
              onChange={(e) => setPowerIndex(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Academics */}
      <Card>
        <CardHeader>
          <CardTitle>Academics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="satMath">SAT Math</Label>
              <Input
                id="satMath"
                type="number"
                min="200"
                max="800"
                step="10"
                placeholder="200–800"
                value={satMath}
                onChange={(e) => setSatMath(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="satEBRW">SAT Reading & Writing</Label>
              <Input
                id="satEBRW"
                type="number"
                min="200"
                max="800"
                step="10"
                placeholder="200–800"
                value={satEBRW}
                onChange={(e) => setSatEBRW(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="satComposite">SAT Composite</Label>
              <Input
                id="satComposite"
                type="number"
                min="400"
                max="1600"
                step="10"
                placeholder="400–1600"
                value={satComposite}
                onChange={(e) => setSatComposite(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gpa">GPA</Label>
              <Input
                id="gpa"
                type="number"
                step="0.01"
                min="0"
                max="5.0"
                placeholder="e.g. 3.85"
                value={gpa}
                onChange={(e) => setGpa(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="graduationYear">Graduation Year</Label>
              <Input
                id="graduationYear"
                type="number"
                min="2020"
                max="2035"
                step="1"
                placeholder="e.g. 2027"
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="studyAbroadInterest"
              checked={studyAbroadInterest}
              onCheckedChange={(checked) => setStudyAbroadInterest(checked === true)}
            />
            <Label htmlFor="studyAbroadInterest">Interested in study abroad</Label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="divisionPreference">Division Preference</Label>
              <Select value={divisionPreference} onValueChange={setDivisionPreference}>
                <SelectTrigger id="divisionPreference">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Not set</SelectItem>
                  {DIVISION_PREFERENCES.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sizePreference">Size Preference</Label>
            <Select value={sizePreference} onValueChange={setSizePreference}>
              <SelectTrigger id="sizePreference">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET}>Not set</SelectItem>
                {SIZE_PREFERENCES.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="geographyNotes">Geography Notes</Label>
            <Textarea
              id="geographyNotes"
              placeholder="e.g. open to anywhere, prefers East Coast"
              rows={3}
              value={geographyNotes}
              onChange={(e) => setGeographyNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Interviews */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Interviews</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Writing Profile</CardTitle>
                {writingProfile ? (
                  <Badge variant="secondary">Complete</Badge>
                ) : (
                  <Badge variant="outline">Not started</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {writingProfile ? (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {firstSentencePreview(writingProfile)}
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/profile/interview">Redo interview</Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Short chat so coach emails sound like you.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/profile/interview">Start interview</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Study Abroad</CardTitle>
                {studyAbroadProfile ? (
                  <Badge variant="secondary">Complete</Badge>
                ) : (
                  <Badge variant="outline">Not started</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {studyAbroadProfile ? (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {firstSentencePreview(studyAbroadProfile)}
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/profile/study-abroad-interview">
                      Redo interview
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Capture what you want from study abroad in college.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/profile/study-abroad-interview">
                      Start interview
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}
