/**
 * Comma-separated ALLOWED_EMAILS (case-insensitive).
 * - Production + empty/missing: deny all (misconfigured deploy must not open the app).
 * - Development + empty: allow any Google account (convenience for local work).
 */
export type EmailAllowlistState =
  | { kind: "list"; emails: Set<string> }
  | { kind: "allowAny" }
  | { kind: "denyAll" };

export function getEmailAllowlistState(): EmailAllowlistState {
  const raw = process.env.ALLOWED_EMAILS?.trim() ?? "";
  if (!raw) {
    return process.env.NODE_ENV === "production" ? { kind: "denyAll" } : { kind: "allowAny" };
  }
  const emails = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  if (emails.size === 0) {
    return process.env.NODE_ENV === "production" ? { kind: "denyAll" } : { kind: "allowAny" };
  }
  return { kind: "list", emails };
}

export function emailIsAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const norm = email.trim().toLowerCase();
  const state = getEmailAllowlistState();
  if (state.kind === "allowAny") return true;
  if (state.kind === "denyAll") return false;
  return state.emails.has(norm);
}
