import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  getGmailClient,
  getHeader,
  extractEmailAddress,
  extractEmailDomain,
} from "@/lib/gmail/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gmail = await getGmailClient();
  if (!gmail) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const maxResults = Math.min(Number(searchParams.get("maxResults")) || 20, 50);
  const pageToken = searchParams.get("pageToken") || undefined;

  let listRes;
  try {
    listRes = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults,
      pageToken,
    });
  } catch (err: unknown) {
    const status = (err as { code?: number })?.code;
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("Gmail list error:", err);
    return NextResponse.json({ error: "Gmail API error" }, { status: 502 });
  }

  if (!listRes.data.messages?.length) {
    return NextResponse.json({
      messages: [],
      nextPageToken: null,
    });
  }

  const [allDomains, allLinks] = await Promise.all([
    prisma.schoolEmailDomain.findMany({ include: { school: { select: { id: true, name: true } } } }),
    prisma.gmailSchoolLink.findMany({
      where: { gmailMessageId: { in: listRes.data.messages.map((m) => m.id!) } },
      include: { school: { select: { id: true, name: true } } },
    }),
  ]);

  const domainMap = new Map(allDomains.map((d) => [d.domain.toLowerCase(), d.school]));
  const linkMap = new Map(allLinks.map((l) => [l.gmailMessageId, l.school]));

  const messages = await Promise.all(
    listRes.data.messages.map(async (m) => {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "To", "Date"],
      });

      const headers = full.data.payload?.headers;
      const from = getHeader(headers, "From");
      const senderAddr = extractEmailAddress(from);
      const senderDomain = extractEmailDomain(senderAddr);

      let matchedSchool: { id: string; name: string } | null = null;

      const manualLink = linkMap.get(m.id!);
      if (manualLink) {
        matchedSchool = manualLink;
      } else if (senderDomain) {
        const domainSchool = domainMap.get(senderDomain);
        if (domainSchool) {
          matchedSchool = domainSchool;
        }
      }

      return {
        id: m.id,
        threadId: m.threadId,
        snippet: full.data.snippet,
        from,
        to: getHeader(headers, "To"),
        subject: getHeader(headers, "Subject"),
        date: getHeader(headers, "Date"),
        labelIds: full.data.labelIds,
        matchedSchool,
      };
    }),
  );

  return NextResponse.json({
    messages,
    nextPageToken: listRes.data.nextPageToken ?? null,
  });
}
