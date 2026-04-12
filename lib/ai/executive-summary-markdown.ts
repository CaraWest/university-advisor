/**
 * Fix LLM hard-wraps so markdown renders as normal paragraphs (not one `<br>` per newline).
 */

/** List item, blockquote, or horizontal rule — preserve newlines for markdown structure. */
const STRUCTURAL_LINE =
  /^(>\s|\d+\.\s|\s*[-*+]\s|\s*---+(\s*$)|```|\s*\*\*\*+\s*$)/;

/** `join` lines can yield `end.Next` — restore a space after sentence end. */
const PUNCT_SPACE = /([.!?])([A-Za-z])/g;

/** Em dash (unicode U+2014) or ASCII substitutes — normalize splits after them. */
const EM_DASH_START = /^\s*[\u2014—]\s*\S/;
/** Opening line that reads like "Vassar competes…" after a bogus paragraph break (e.g. after an award line). */
const SUBJECT_VERB_OPEN =
  /^[A-Z][a-z]+ (competes|competed|ranked|ranking|plays|played|offers|provides|participates|fields|features)\b/;
/** "Colorado College has…", two-word proper name + common predicate (executive-summary prose). */
const PROPER_NAME_PAIR_VERB =
  /^[A-Z][a-z]+ [A-Z][a-z]+ (offers|has|have|had|is|was|were|provides|requires|maintains|emphasizes|includes|combines|gives|posted|won|captured)\b/;

/** "Since 2001, …" / "50% of …" / "The Soll Center …" after a spurious break with no period on the prior chunk. */
const NEW_SENTENCE_LEADERS = /^(?:Since\s+|\d+%\s|The [A-Z][a-z]+ [A-Z][a-z]+\b)/;
/**
 * "CMC offers…", "USC and…" — 3–5 all-caps letters then a lowercase-led word (not "Vassar", not "Stanford").
 */
const ALL_CAPS_SHORT_LEAD = /^[A-Z]{3,5}\s+[a-z]/;

function opensNewSentenceAfterDroppedPeriod(s: string): boolean {
  return (
    SUBJECT_VERB_OPEN.test(s) ||
    PROPER_NAME_PAIR_VERB.test(s) ||
    /^(She|He|They|It|This|We)\s+\S/.test(s) ||
    /^The (men|women|team|program|block|school|college|center|department|faculty|swimmers?|curriculum|major|minor)\s+\S/i.test(s) ||
    /** "The Soll Center", "The Washington Program" — not "The most" / "The college" (lowercase third token). */
    NEW_SENTENCE_LEADERS.test(s) ||
    ALL_CAPS_SHORT_LEAD.test(s) ||
    /^Destinations\s+\S/i.test(s) ||
    /^Students\s+\S/.test(s) ||
    /^For\s+(a|the)\s+\S/i.test(s)
  );
}

const MINOR_TITLE_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "nor",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function normalizeBlock(block: string): string {
  const t = block.trim();
  if (!t) return t;
  const lines = t.split("\n");
  const first = lines[0]?.trim() ?? "";
  /** Leading ATX heading: fold following lines as prose in a separate pass. */
  if (/^#{1,6}\s/.test(first)) {
    const rest = lines.slice(1).join("\n").trim();
    if (!rest) return first;
    return `${first}\n\n${normalizeBlock(rest)}`;
  }
  if (lines.some((l) => STRUCTURAL_LINE.test(l.trim()))) {
    return t;
  }
  /** "Cost and Financial Aid\\nThe annual…" — model often uses a single newline after a section label. */
  if (lines.length >= 2) {
    const firstLine = lines[0]?.trim() ?? "";
    if (firstLine && looksLikeStandaloneTitle(firstLine)) {
      const restRaw = lines.slice(1).join("\n").trim();
      if (restRaw) {
        const subblocks = restRaw
          .split(/\n{2,}/)
          .map((s) => normalizeBlock(s.trim()))
          .filter(Boolean);
        return `## ${firstLine}\n\n${subblocks.join("\n\n")}`;
      }
    }
  }
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replace(PUNCT_SPACE, "$1 $2")
    .replace(/  +/g, " ");
}

/**
 * One-line topic heading with no sentence end (e.g. "Law School Outcomes").
 * Promoted to `##` later so it doesn’t get merged into the next paragraph.
 */
function looksLikeStandaloneTitle(block: string): boolean {
  const t = block.trim();
  if (!t || t.includes("\n")) return false;
  if (/^#{1,6}\s/.test(t)) return false;
  if (/[.!?]/.test(t)) return false;
  if (/[,;:]\s*$/.test(t)) return false;
  if (t.length > 120) return false;
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 12) return false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const letters = w.replace(/[^A-Za-z]/g, "").toLowerCase();
    if (letters && MINOR_TITLE_WORDS.has(letters)) continue;
    if (!/^[A-Z0-9]/.test(w)) return false;
  }
  return true;
}

function promoteImpliedHeading(block: string): string {
  const t = block.trim();
  if (looksLikeStandaloneTitle(t)) return `## ${t}`;
  return t;
}

/** Next block starts its own markdown structure — never glue to previous prose. */
function startsMarkdownBlock(s: string): boolean {
  return /^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```)/.test(s.trim());
}

/**
 * Model often inserts blank lines mid-sentence. Those become separate `<p>`s; merge
 * when the previous chunk clearly continues into the next.
 */
function mergeSpuriousParagraphBreaks(blocks: string[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    const t = b.trim();
    if (!t) continue;
    if (out.length === 0) {
      out.push(t);
      continue;
    }
    const prev = out[out.length - 1];
    if (/^#{1,6}\s/.test(prev)) {
      out.push(t);
      continue;
    }
    if (startsMarkdownBlock(t)) {
      out.push(t);
      continue;
    }
    /** List / quote blocks from normalizeBlock — don’t merge from prior prose. */
    if (/\n\s*[-*+]\s/.test(t) || /\n\s*\d+\.\s/.test(t)) {
      out.push(t);
      continue;
    }
    const prevEndsSentence = /[.!?]["')\]]?\s*$/.test(prev);
    const curStartsLower = /^[a-z(]/.test(t);
    const curIsSentenceSuffix = /^\.\s/.test(t);
    /** Don’t merge on “no terminal punctuation” alone — fixes “…application process” + “Vassar…”. */
    const prevEndsWithContinuationMarker =
      /[,;:]\s*$/.test(prev) || /\b(and|or|but)\s*$/i.test(prev);
    const curLead = t.trimStart();
    const curStartsWithEmDash = EM_DASH_START.test(t);
    const curOpensNewSentenceAfterBadBreak =
      !prevEndsSentence && opensNewSentenceAfterDroppedPeriod(curLead);
    /**
     * "has a\\n\\n3+3 partnership" — digit continues the same sentence after an article.
     * Require prior `a`/`an`/`the` so we don’t join e.g. "…cost" + "100%…".
     */
    const prevEndsWithArticle = /\b(a|an|the)\s*$/i.test(prev);
    const curNumericContinuation =
      !prevEndsSentence && /^\d/.test(curLead) && prevEndsWithArticle;
    const curArticleContinuation =
      !prevEndsSentence && prevEndsWithArticle && /^[A-Z]/.test(curLead);
    const shouldMerge =
      curStartsLower ||
      curIsSentenceSuffix ||
      curStartsWithEmDash ||
      curOpensNewSentenceAfterBadBreak ||
      curNumericContinuation ||
      curArticleContinuation ||
      (!prevEndsSentence && prevEndsWithContinuationMarker);
    if (shouldMerge) {
      let sep = /^\./.test(t) ? "" : " ";
      if (curStartsWithEmDash) sep = "";
      else if (curArticleContinuation) sep = " ";
      else if (curOpensNewSentenceAfterBadBreak) sep = ". ";
      out[out.length - 1] = prev.replace(PUNCT_SPACE, "$1 $2") + sep + t.replace(PUNCT_SPACE, "$1 $2");
      out[out.length - 1] = out[out.length - 1].replace(/  +/g, " ");
    } else {
      out.push(t);
    }
  }
  return out;
}

export function normalizeExecutiveSummaryLinebreaks(raw: string): string {
  let t = raw.trim();
  if (!t) return t;
  /** "excellence—\\n\\nboth" or line break right after an em dash — keep one space after dash. */
  t = t.replace(/([\u2014—])[^\S\r\n]*\n+\s*/g, "$1 ");
  /** Newline(s) before comma/semicolon — continue same sentence. */
  t = t.replace(/\n+\s*([,;])\s*/g, "$1 ");
  /** Colon + line break + lowercase continuation ("flexible:" / "students…"). */
  t = t.replace(/:[^\S\r\n]*\n+\s*(?=[a-z])/g, ": ");
  /** Hyphenated word split across lines: "well-\nknown" → "well-known". */
  t = t.replace(/(?<=[a-zA-Z])[^\S\r\n]*-\n+\s*(?=[a-z])/g, "-");
  /**
   * Mid-sentence wrap: line ends with a letter (optional spaces), next starts lowercase.
   * Uses horizontal whitespace only before \n so `\s*` cannot swallow needed newlines.
   */
  t = t.replace(/(?<=[a-z])[^\S\r\n]*\n+\s*(?=[a-z])/g, " ");

  const blocks = t.split(/\n{2,}/);
  const folded = blocks.map((b) => normalizeBlock(b)).filter((b) => {
    if (!b) return false;
    const one = b.trim();
    if (/^\.+$/.test(one)) return false;
    return true;
  });

  const withHeadings = folded.map((b) => promoteImpliedHeading(b));
  const merged = mergeSpuriousParagraphBreaks(withHeadings);
  return ensureTrailingPeriods(merged).join("\n\n");
}

/**
 * Append a period to any prose paragraph that ends without sentence punctuation.
 * Skips headings, lists, and code fences.
 */
function ensureTrailingPeriods(blocks: string[]): string[] {
  return blocks.map((b) => {
    const trimmed = b.trimEnd();
    if (/^#{1,6}\s/.test(trimmed)) return b;
    if (STRUCTURAL_LINE.test(trimmed)) return b;
    if (/[.!?]["')\]]?\s*$/.test(trimmed)) return b;
    return trimmed + ".";
  });
}
