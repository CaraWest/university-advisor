import type { PrismaClient } from "@prisma/client";

/** Inferred from the Prisma client so we always match `schema.prisma` without duplicate fields. */
export type StudentProfile = NonNullable<
  Awaited<ReturnType<PrismaClient["studentProfile"]["findFirst"]>>
>;
