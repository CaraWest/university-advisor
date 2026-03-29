import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "University Advisor",
  description: "College search and decision support for Abigail",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
