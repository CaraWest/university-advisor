import type { PrismaClient } from "@prisma/client";
import { SEED_SCHOOLS } from "./seed-schools";

/** Wipes schools + related rows, then inserts seed data. */
export async function reseedAll(prisma: PrismaClient) {
  if (process.env.CONFIRM_RESEED !== "true") {
    throw new Error(
      "reseedAll wipes ALL data. Set CONFIRM_RESEED=true to proceed.",
    );
  }
  await prisma.$transaction([
    prisma.coachContact.deleteMany(),
    prisma.swimData.deleteMany(),
    prisma.academicProfile.deleteMany(),
    prisma.financialModel.deleteMany(),
    prisma.school.deleteMany(),
  ]);

  await prisma.school.createMany({
    data: SEED_SCHOOLS.map((row) => ({
      name: row.name,
      state: row.state,
      city: row.city,
      institutionType: row.institutionType,
      status: "None",
      abigailFavorite: false,
      interested: false,
      phoneCall: false,
      campusVisit: false,
    })),
  });
}
