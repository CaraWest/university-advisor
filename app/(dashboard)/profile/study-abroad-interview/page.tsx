import type { Metadata } from "next";

import { StudyAbroadInterviewClient } from "@/components/profile/study-abroad-interview-client";

export const metadata: Metadata = {
  title: "Study Abroad Interview",
};

export default function StudyAbroadInterviewPage() {
  return (
    <div className="w-full min-w-0 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Study Abroad Interview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A short conversation to capture what you want from study abroad in
          college.
        </p>
      </div>
      <StudyAbroadInterviewClient />
    </div>
  );
}
