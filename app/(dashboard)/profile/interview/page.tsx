import type { Metadata } from "next";

import { InterviewPageClient } from "@/components/profile/interview-page-client";

export const metadata: Metadata = {
  title: "Writing Voice Interview",
};

export default function InterviewPage() {
  return (
    <div className="w-full min-w-0 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Writing Voice Interview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Have a quick conversation so we can learn how you write, then
          we&apos;ll generate a writing profile for your coach emails.
        </p>
      </div>
      <InterviewPageClient />
    </div>
  );
}
