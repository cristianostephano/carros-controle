"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { generateMonthlyCyclePeriod } from "@/lib/periods";
import { ensureNationalHolidaysSeededForRange } from "@/lib/holidaySeed";

function parseDateInput(value: string): Date {
  // input type="date" já entrega yyyy-mm-dd; guardamos meio-dia UTC pra evitar
  // problemas de "virar o dia" ao exibir só a data.
  return new Date(`${value}T12:00:00.000Z`);
}

export async function createPeriod(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const responseDeadline = String(formData.get("responseDeadline") ?? "");

  if (!label || !startDate || !endDate) {
    throw new Error("Preencha nome, data inicial e data final do período.");
  }

  const parsedStart = parseDateInput(startDate);
  const parsedEnd = parseDateInput(endDate);
  await ensureNationalHolidaysSeededForRange(parsedStart, parsedEnd);

  const period = await prisma.period.create({
    data: {
      label,
      startDate: parsedStart,
      endDate: parsedEnd,
      responseDeadline: responseDeadline ? parseDateInput(responseDeadline) : null,
      status: "OPEN",
    },
  });

  redirect(`/periodos/${period.id}`);
}

export async function generateMonthlyPeriod(formData: FormData) {
  const [yearStr, monthStr] = String(formData.get("month") ?? "").split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) throw new Error("Escolha um mês válido.");

  const cycle = generateMonthlyCyclePeriod(year, month);
  await ensureNationalHolidaysSeededForRange(cycle.startDate, cycle.endDate);

  const existing = await prisma.period.findFirst({
    where: { startDate: cycle.startDate, endDate: cycle.endDate },
  });
  const period =
    existing ??
    (await prisma.period.create({
      data: {
        label: cycle.label,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        responseDeadline: cycle.responseDeadline,
        status: "OPEN",
      },
    }));

  redirect(`/periodos/${period.id}`);
}
