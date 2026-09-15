"use server";

import { prisma } from "@/lib/prisma";
import { generateAccessToken } from "@/lib/token";
import { revalidatePath } from "next/cache";

export async function generateOrGetLink(periodId: string, salespersonId: string) {
  const existing = await prisma.salespersonAccessLink.findUnique({
    where: { periodId_salespersonId: { periodId, salespersonId } },
  });
  if (existing) return existing;

  const period = await prisma.period.findUniqueOrThrow({ where: { id: periodId } });

  return prisma.salespersonAccessLink.create({
    data: {
      token: generateAccessToken(),
      periodId,
      salespersonId,
      expiresAt: period.responseDeadline,
    },
  });
}

export async function regenerateLink(periodId: string, salespersonId: string) {
  await prisma.salespersonAccessLink.delete({
    where: { periodId_salespersonId: { periodId, salespersonId } },
  });
  await generateOrGetLink(periodId, salespersonId);
  revalidatePath(`/periodos/${periodId}/vendedores/${salespersonId}`);
}

export async function setLinkLocked(periodId: string, salespersonId: string, locked: boolean) {
  await prisma.salespersonAccessLink.update({
    where: { periodId_salespersonId: { periodId, salespersonId } },
    data: { locked },
  });
  revalidatePath(`/periodos/${periodId}/vendedores/${salespersonId}`);
}
