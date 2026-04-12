import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAnthropicApiKey } from "@/lib/ai/call-anthropic";
import { toAnthropicInterviewMessages } from "@/lib/ai/interview-messages";
import { zodErrorResponse } from "@/lib/api/zod-error-response";

const INTERVIEW_SYSTEM_PROMPT = `You are helping Abigail, a high school student, think through what she wants from a study abroad experience in college. Your job is to have a warm, genuinely curious conversation — not a survey. Ask one question at a time. Let her answers guide you.

Cover these areas naturally across the conversation:
- How important study abroad is to her overall — is it essential, exciting but optional, or somewhere in between?
- Whether she'd want to go with classmates from her own school or is comfortable going solo into a mixed cohort of students from different universities
- Whether she has a region, country, or language she's drawn to, or is she wide open
- How long she imagines going — a semester, a full year, multiple shorter experiences
- Whether she has a sense of what a great study abroad experience looks like for her specifically — is she looking for a particular region, language immersion, a program her classmates are doing, or something else entirely

After 8-10 exchanges, tell her you have a good picture and invite her to click the button to save her study abroad profile.`;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const requestSchema = z.object({
  messages: z.array(messageSchema),
});

export async function POST(request: Request) {
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
      system: INTERVIEW_SYSTEM_PROMPT,
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
