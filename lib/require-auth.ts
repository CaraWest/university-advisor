import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { emailIsAllowed } from "@/lib/allowed-emails";

/**
 * Server route guard: valid session + email allowlist. Use at the top of each API handler.
 */
export async function requireAuthSession(): Promise<
  { ok: true; session: Session } | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!session || !email) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!emailIsAllowed(email)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, session };
}
