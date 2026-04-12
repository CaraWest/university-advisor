import Anthropic from "@anthropic-ai/sdk";

import { normalizeExecutiveSummaryLinebreaks } from "@/lib/ai/executive-summary-markdown";

const DEFAULT_MODEL = "claude-sonnet-4-5";

function getModel(): string {
  const m = process.env.ANTHROPIC_MODEL?.trim();
  return m && m.length > 0 ? m : DEFAULT_MODEL;
}

export function requireAnthropicApiKey(): string | null {
  const k = process.env.ANTHROPIC_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

/**
 * Web-search-enabled completion for executive summaries.
 * Uses the web_search tool so the model can research the school live.
 * Handles the pause_turn loop for multi-turn web search.
 */
const EXECUTIVE_SUMMARY_SYSTEM = `You are a university research assistant. Your output is persisted as the student's report — not a chat log.

Rules:
- Output ONLY markdown the reader should see: headings, bullets, factual sentences.
- Never describe your process: no "I have gathered", "Let me compile", "Now I'll", "Based on my research", "Here is the summary", or any first-person planning.
- After tool/web search is done, your final user-visible reply must be ONLY the report. Do not preface sections with transition sentences about what you are about to write.
- The first lines of your final output should be real content (e.g. a ## section heading and facts), not meta commentary.`;

/**
 * Strip LLM process narration from the top of the output only — the model
 * sometimes prefixes the real report with "Now I have gathered…" or similar.
 * Everything after the first real content line is left untouched.
 */
export function sanitizeExecutiveSummaryMarkdown(raw: string): string {
  let t = raw.trim();
  if (!t) return t;
  t = stripLeadingMetaLines(t);
  t = normalizeExecutiveSummaryLinebreaks(t);
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

function isMetaLine(s: string): boolean {
  if (/^now i have (gathered|compiled|reviewed|completed|finished)\b/i.test(s)) return true;
  if (/^i have now (gathered|compiled)\b/i.test(s)) return true;
  if (/^i've (now )?(gathered|compiled|reviewed)\b/i.test(s)) return true;
  if (/^let me (now )?(compile|organize|put together|structure|summarize)\b/i.test(s)) return true;
  if (/^i have gathered enough (information|context)\b/i.test(s)) return true;
  if (/^(i'll|i will|i need to) (now )?(compile|organize|search|gather|write)\b/i.test(s)) return true;
  if (/^(here'?s|here is) (the |a |my )?(summary|report|overview|write-?up)\s*[.:]?\s*$/i.test(s)) return true;
  if (/^i('ve| have) (completed|finished) (my )?research\b/i.test(s)) return true;
  return false;
}

/** Drop meta lines from the beginning only; stop as soon as real content appears. */
function stripLeadingMetaLines(text: string): string {
  const lines = text.split("\n");
  let firstReal = 0;
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].trim();
    if (!s) continue;
    if (isMetaLine(s)) {
      firstReal = i + 1;
      continue;
    }
    break;
  }
  return lines.slice(firstReal).join("\n");
}

export async function completeExecutiveSummary(userMessage: string): Promise<string> {
  const apiKey = requireAnthropicApiKey();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client = new Anthropic({ apiKey });
  const model = getModel();

  const tools: Anthropic.Tool[] = [
    {
      type: "web_search_20250305" as unknown as "custom",
      name: "web_search",
      max_uses: 10,
    } as unknown as Anthropic.Tool,
  ];

  const userContent = userMessage;

  let response = await client.messages.create({
    model,
    max_tokens: 8192,
    system: EXECUTIVE_SUMMARY_SYSTEM,
    tools,
    messages: [{ role: "user", content: userContent }],
  });

  while (response.stop_reason === "pause_turn") {
    response = await client.messages.create({
      model,
      max_tokens: 8192,
      system: EXECUTIVE_SUMMARY_SYSTEM,
      tools,
      messages: [
        { role: "user", content: userContent },
        { role: "assistant", content: response.content },
      ],
    });
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();

  if (!text) {
    throw new Error("Empty response from model");
  }
  return sanitizeExecutiveSummaryMarkdown(text);
}
