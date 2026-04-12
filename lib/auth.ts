import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { emailIsAllowed } from "@/lib/allowed-emails";

async function refreshAccessToken(token: {
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
}) {
  try {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken!,
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!res.ok || !data.access_token) {
      throw new Error(data.error ?? "Failed to refresh token");
    }

    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    };
  } catch {
    return { ...token, accessToken: undefined, error: "RefreshTokenError" };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.compose",
          access_type: "offline",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!emailIsAllowed(user?.email)) {
        return false;
      }
      return true;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        return token;
      }

      const expiresAt = (token.expiresAt as number | undefined) ?? 0;
      if (Date.now() / 1000 < expiresAt - 60) {
        return token;
      }

      if (!token.refreshToken) {
        return { ...token, accessToken: undefined };
      }

      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
};
