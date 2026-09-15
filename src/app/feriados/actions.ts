"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function parseDateInput(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

export async function createHolidayException(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const scope = String(formData.get("scope") ?? "MUNICIPAL");
  const type = String(formData.get("type") ?? "FOLGA");
  const customWindowStart = String(formData.get("customWindowStart") ?? "").trim();
  const customWindowEnd = String(formData.get("customWindowEnd") ?? "").trim();

  if (!date || !name) {
    throw new Error("Preencha a data e o nome do feriado/exceção.");
  }

  await prisma.holiday.create({
    data: {
      date: parseDateInput(date),
      name,
      scope,
      type,
      customWindowStart: type === "DIA_UTIL_ESPECIAL" && customWindowStart ? customWindowStart : null,
      customWindowEnd: type === "DIA_UTIL_ESPECIAL" && customWindowEnd ? customWindowEnd : null,
    },
  });

  revalidatePath("/feriados");
}

export async function deleteHoliday(id: string) {
  await prisma.holiday.delete({ where: { id } });
  revalidatePath("/feriados");
}
