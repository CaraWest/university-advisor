import type { LaunchOptions } from "playwright";

/**
 * Chromium flags that reduce obvious automation signals. Cloudflare may still block
 * Playwright-launched browsers; see SWIMCLOUD_CDP_URL on auth.ts for attaching to real Chrome.
 */
const REDUCE_AUTOMATION_ARGS = ["--disable-blink-features=AutomationControlled"] as const;

/** Omitted default flags that mark the process as automated (Turnstile often loops otherwise). */
const IGNORE_DEFAULT_AUTOMATION = ["--enable-automation"] as const;

export function swimcloudChromiumLaunchHints(): Pick<LaunchOptions, "ignoreDefaultArgs" | "args"> {
  return {
    ignoreDefaultArgs: [...IGNORE_DEFAULT_AUTOMATION],
    args: [...REDUCE_AUTOMATION_ARGS],
  };
}
