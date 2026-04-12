import type { Metadata } from "next";

import { ProfilePageClient } from "@/components/profile/profile-page-client";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return (
    <div className="w-full min-w-0 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Student Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Abigail&apos;s info used by AI features across the app. Changes save immediately.
        </p>
      </div>
      <ProfilePageClient />
    </div>
  );
}
