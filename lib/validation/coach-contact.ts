import { z } from "zod";

export const COACH_DIRECTIONS = ["Inbound", "Outbound"] as const;
export const COACH_TYPES = ["Email", "Call", "Camp", "Visit", "Other"] as const;

const dateFromString = z.string().transform((s, ctx) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: "custom", message: "Invalid date" });
    return z.NEVER;
  }
  return d;
});

export const coachContactCreateSchema = z
  .object({
    date: dateFromString,
    direction: z.enum(COACH_DIRECTIONS),
    type: z.enum(COACH_TYPES),
    summary: z.string().min(1, "Summary is required"),
  })
  .strict();

export const coachContactPatchSchema = z
  .object({
    date: dateFromString.optional(),
    direction: z.enum(COACH_DIRECTIONS).optional(),
    type: z.enum(COACH_TYPES).optional(),
    summary: z.string().min(1).optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field required" });
