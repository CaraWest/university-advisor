# AI executive summary — API key, models, and prompt storage

School-level summaries use the **Anthropic Messages API** from a **server-only** route. Nothing in this section is exposed to browser bundles.

## API key

1. Create a key in the [Anthropic Console](https://console.anthropic.com/) (API keys section).
2. Add it to **`.env`** in the project root (same file as `DATABASE_URL`). `.env` is gitignored; do not commit keys.

   ```bash
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

3. If you do not have `.env` yet, copy from `.env.example` or run `npm run dev` once (the repo can bootstrap `.env` from the example).

4. **Restart the dev server** after changing `.env` so Next.js picks up new variables.

Without a non-empty `ANTHROPIC_API_KEY`, **Generate summary** returns **503** and explains that the server is not configured.

## Models

The Claude model is chosen in this order:

1. **`ANTHROPIC_MODEL`** in `.env` (optional), trimmed and passed through to the API as-is.
2. If unset or blank, the app uses the built-in default: **`claude-sonnet-4-6`** (see [`lib/ai/call-anthropic.ts`](../lib/ai/call-anthropic.ts)).

To use a different model, set for example:

```bash
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

Authoritative IDs and aliases change over time; check Anthropic’s **[Models overview](https://docs.anthropic.com/en/docs/about-claude/models/overview)** when upgrading. You can also discover IDs with the [Models API](https://docs.anthropic.com/en/api/models-list).

## Storing the prompt

The **global** instruction text for summaries is **not** in `.env`. It lives in the database:

| Location | Field | Purpose |
|----------|--------|--------|
| SQLite (Prisma) | **`AppSettings.summaryPrompt`** | Parent-authored template sent to the model together with school JSON context. |
| Same row | **`AppSettings.promptUpdatedAt`** | Set when the prompt is saved via the API. |

**How to edit in the app**

- Open **`/settings`** in the browser, edit the textarea, click **Save prompt**. That calls **`PATCH /api/settings`** with `{ "summaryPrompt": "..." }` (or `null` to clear).

**Empty prompt**

- If `summaryPrompt` is **null** or only whitespace after trim, the server uses the default instruction string in [`lib/ai/school-summary-context.ts`](../lib/ai/school-summary-context.ts) (`DEFAULT_SUMMARY_INSTRUCTION`).

**What gets appended automatically**

- The saved prompt is **not** the whole request. At generation time the app appends a **JSON block** of school facts (identity, geo, swim, academic profile, research — see [data spec §2.7 context rules](context/university_advisor_data_spec.md#27-appsettings)). You only maintain the high-level instructions in Settings.

## Generating summaries

On a school detail page, **Generate** runs only when no summary exists; **Regenerate** replaces an existing summary. Both use **`POST /api/schools/[id]/ai-summary`** with body `{ "action": "generate" }` or `{ "action": "regenerate" }`.

## Reference

- Phase plan: [docs/plans/phase-05-ai-settings.md](plans/phase-05-ai-settings.md)
- Env template: [.env.example](../.env.example)
