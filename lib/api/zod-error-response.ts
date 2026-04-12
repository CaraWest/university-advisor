import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function zodErrorResponse(error: ZodError) {
  return NextResponse.json(
    {
      error: "Validation failed",
      issues: error.flatten(),
    },
    { status: 400 },
  );
}
