import { NextResponse } from "next/server";

import { getGmailClient } from "@/lib/gmail/client";
import { requireAuthSession } from "@/lib/require-auth";

export async function POST(request: Request) {
  const auth = await requireAuthSession();
  if (!auth.ok) return auth.response;

  const gmail = await getGmailClient();
  if (!gmail) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { to, subject, messageBody } = body as {
    to?: string;
    subject?: string;
    messageBody?: string;
  };

  if (!to || !subject) {
    return NextResponse.json(
      { error: "to and subject are required" },
      { status: 400 },
    );
  }

  const raw = Buffer.from(
    [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      messageBody ?? "",
    ].join("\r\n"),
  ).toString("base64url");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return NextResponse.json({ id: res.data.id, threadId: res.data.threadId });
}
