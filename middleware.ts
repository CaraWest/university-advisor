import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { emailIsAllowed } from "@/lib/allowed-emails";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const tokenEmail = typeof token?.email === "string" ? token.email : null;

  if (token && tokenEmail && !emailIsAllowed(tokenEmail)) {
    const out = new URL("/api/auth/signout", req.url);
    out.searchParams.set("callbackUrl", "/login?error=AccessDenied");
    return NextResponse.redirect(out);
  }

  const sessionValid = Boolean(token && tokenEmail && emailIsAllowed(tokenEmail));

  if (pathname === "/login") {
    if (sessionValid) {
      const dest = req.nextUrl.searchParams.get("callbackUrl");
      const safe =
        dest && dest.startsWith("/") && !dest.startsWith("//") ? dest : "/schools";
      return NextResponse.redirect(new URL(safe, req.url));
    }
    return NextResponse.next();
  }

  if (!sessionValid) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    const callback = pathname + (req.nextUrl.search || "");
    login.searchParams.set("callbackUrl", callback);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
