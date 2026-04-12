import { NextResponse } from "next/server";

import { getGmailClient, getHeader } from "@/lib/gmail/client";

export const dynamic = "force-dynamic";

function decodeBody(body: { data?: string | null }): string {
  if (!body.data) return "";
  return Buffer.from(body.data, "base64url").toString("utf-8");
}

function extractTextFromParts(
  parts: { mimeType?: string | null; body?: { data?: string | null }; parts?: unknown[] }[] | undefined,
): { text: string; html: string } {
  let text = "";
  let html = "";

  if (!parts) return { text, html };

  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body) {
      text += decodeBody(part.body);
    } else if (part.mimeType === "text/html" && part.body) {
      html += decodeBody(part.body);
    } else if (part.parts) {
      const nested = extractTextFromParts(
        part.parts as { mimeType?: string | null; body?: { data?: string | null }; parts?: unknown[] }[],
      );
      if (nested.text) text += nested.text;
      if (nested.html) html += nested.html;
    }
  }

  return { text, html };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ messageId: string }> | { messageId: string } },
) {
  const gmail = await getGmailClient();
  if (!gmail) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const params = await Promise.resolve(context.params);

  const full = await gmail.users.messages.get({
    userId: "me",
    id: params.messageId,
    format: "full",
  });

  const headers = full.data.payload?.headers;
  let body = { text: "", html: "" };

  if (full.data.payload?.parts) {
    body = extractTextFromParts(
      full.data.payload.parts as { mimeType?: string | null; body?: { data?: string | null }; parts?: unknown[] }[],
    );
  } else if (full.data.payload?.body?.data) {
    const decoded = decodeBody(full.data.payload.body);
    if (full.data.payload.mimeType === "text/html") {
      body.html = decoded;
    } else {
      body.text = decoded;
    }
  }

  return NextResponse.json({
    id: full.data.id,
    threadId: full.data.threadId,
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    subject: getHeader(headers, "Subject"),
    date: getHeader(headers, "Date"),
    labelIds: full.data.labelIds,
    body,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ messageId: string }> | { messageId: string } },
) {
  const gmail = await getGmailClient();
  if (!gmail) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const params = await Promise.resolve(context.params);

  try {
    await gmail.users.messages.trash({
      userId: "me",
      id: params.messageId,
    });
  } catch (err: unknown) {
    const status = (err as { code?: number })?.code;
    if (status === 404) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    console.error("Gmail trash error:", err);
    return NextResponse.json({ error: "Failed to trash message" }, { status: 502 });
  }

  return new NextResponse(null, { status: 204 });
}
