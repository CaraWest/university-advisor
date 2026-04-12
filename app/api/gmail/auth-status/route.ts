import { NextResponse } from "next/server";

import { requireAuthSession } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuthSession();
  if (!auth.ok) return auth.response;

  const session = auth.session;
  return NextResponse.json({ authenticated: !!session.accessToken });
}
