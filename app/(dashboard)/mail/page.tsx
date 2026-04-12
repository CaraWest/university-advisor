import type { Metadata } from "next";

import { MailPageClient } from "@/components/mail/mail-page-client";

export const metadata: Metadata = { title: "Mail" };

export default function MailPage() {
  return (
    <div className="-mx-4 -mb-10 flex min-h-0 flex-1 sm:-mx-6 lg:-ml-8 lg:-mr-10">
      <MailPageClient />
    </div>
  );
}
