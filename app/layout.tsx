import type { Metadata } from "next";
import { Toaster } from "sonner";

import { SessionProvider } from "@/components/app/session-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "University Advisor", template: "%s · University Advisor" },
  description: "College search and decision support for Abigail",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <SessionProvider>
          {children}
          <Toaster richColors closeButton position="top-center" />
        </SessionProvider>
      </body>
    </html>
  );
}
