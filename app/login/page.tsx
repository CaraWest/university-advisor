"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function LoginInner() {
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(() => {
    const raw = searchParams.get("callbackUrl");
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return "/schools";
  }, [searchParams]);

  const error = searchParams.get("error");

  return (
    <Card className="w-full max-w-md border shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold tracking-tight">University Advisor</CardTitle>
        <CardDescription>Sign in with Google to continue.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error === "AccessDenied" ? (
          <p className="text-sm text-destructive">
            This Google account is not allowed to use this app. Try another account or contact the
            administrator.
          </p>
        ) : null}
        <Button
          type="button"
          className="w-full"
          onClick={() => void signIn("google", { callbackUrl })}
        >
          Continue with Google
        </Button>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-muted/30 p-6">
      <Suspense
        fallback={
          <Card className="w-full max-w-md border shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold tracking-tight">University Advisor</CardTitle>
              <CardDescription>Loading…</CardDescription>
            </CardHeader>
          </Card>
        }
      >
        <LoginInner />
      </Suspense>
    </div>
  );
}
