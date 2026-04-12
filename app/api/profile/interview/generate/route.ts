import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAnthropicApiKey } from "@/lib/ai/call-anthropic";
import { zodErrorResponse } from "@/lib/api/zod-error-response";

const SYNTHESIS_SYSTEM_PROMPT = `Based on the conversation below, write a concise writing profile for Abigail in 3-5 sentences. Describe her natural voice: sentence length, formality level, how she expresses enthusiasm, how she handles professionalism, and any characteristic phrases or patterns. Write it as style guidance for an AI that will draft emails on her behalf — instruction form, not a summary of what she said.`;

const requestSchema = z.object({
  transcript: z.string().min(1),
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

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: SYNTHESIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: parsed.data.transcript }],
  });

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

  return NextResponse.json({ writingProfile: text });
}
