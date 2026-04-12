import { google } from "googleapis";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export async function getGmailClient() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ access_token: session.accessToken });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

export function extractEmailDomain(email: string): string | null {
  const match = email.match(/@([^>]+)/);
  return match ? match[1].toLowerCase().trim() : null;
}

export function extractEmailAddress(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : headerValue.toLowerCase().trim();
}

export function getHeader(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string,
): string {
  if (!headers) return "";
  const h = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}
