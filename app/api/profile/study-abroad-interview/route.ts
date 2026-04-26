import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAnthropicApiKey } from "@/lib/ai/call-anthropic";
import { toAnthropicInterviewMessages } from "@/lib/ai/interview-messages";
import { zodErrorResponse } from "@/lib/api/zod-error-response";
import { requireAuthSession } from "@/lib/require-auth";
import { STUDY_ABROAD_INTERVIEW_SYSTEM_PROMPT } from "@/lib/ai/profile-prompts";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const requestSchema = z.object({
  messages: z.array(messageSchema),
});

export async function POST(request: Request) {
  const auth = await requireAuthSession();
  if (!auth.ok) return auth.response;

  const apiKey = requireAnthropicApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const client = new Anthropic({ apiKey });
  const messagesForApi = toAnthropicInterviewMessages(parsed.data.messages);

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: STUDY_ABROAD_INTERVIEW_SYSTEM_PROMPT,
      messages: messagesForApi,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Anthropic API request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) {
    return NextResponse.json(
      { error: "Empty response from model" },
      { status: 502 },
    );
  }

  return NextResponse.json({ role: "assistant", content: text });
}
