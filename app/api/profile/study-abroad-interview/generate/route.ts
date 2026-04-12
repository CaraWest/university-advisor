import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAnthropicApiKey } from "@/lib/ai/call-anthropic";
import { zodErrorResponse } from "@/lib/api/zod-error-response";

const SYNTHESIS_SYSTEM_PROMPT = `Based on the conversation below, write a concise study abroad profile for Abigail in 3-5 sentences. Cover: how important study abroad is to her, whether she prefers going with classmates from her own school or is comfortable in a mixed cohort, any regional or language interests, preferred duration, and whether the quality of a program matters more to her than the quantity of options available. Write it as structured context for an AI that will use it to evaluate university fit — factual and direct, not a summary of the conversation.`;

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

  return NextResponse.json({ studyAbroadProfile: text });
}
