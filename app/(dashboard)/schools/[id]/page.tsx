import type { Metadata } from "next";

import { SchoolDetailPageClient } from "@/components/schools/school-detail-page-client";
import { prisma } from "@/lib/db";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const school = await prisma.school.findUnique({
    where: { id: params.id },
    select: { name: true },
  });
  return { title: school?.name ?? "School" };
}

export default function SchoolDetailPage({ params }: Props) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl py-8">
      <SchoolDetailPageClient schoolId={params.id} />
    </div>
  );
}
