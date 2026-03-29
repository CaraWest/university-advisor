import type { PrismaClient } from "@prisma/client";
import { SEED_SCHOOLS } from "./seed-schools";

/** Wipes schools + related rows and AppSettings, then inserts seed data and one AppSettings row. */
export async function reseedAll(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.coachContact.deleteMany(),
    prisma.swimData.deleteMany(),
    prisma.academicProfile.deleteMany(),
    prisma.financialModel.deleteMany(),
    prisma.researchBlob.deleteMany(),
    prisma.school.deleteMany(),
    prisma.appSettings.deleteMany(),
  ]);

  await prisma.appSettings.create({
    data: {
      summaryPrompt: null,
      promptUpdatedAt: null,
    },
  });

  await prisma.school.createMany({
    data: SEED_SCHOOLS.map((row) => ({
      name: row.name,
      state: row.state,
      city: row.city,
      institutionType: row.institutionType,
      lifecycleStatus: "Research",
      abigailFavorite: false,
      coachContactedUs: false,
      weContactedCoach: false,
      campusVisit: false,
      applyEarly: false,
    })),
  });
}
