import Holidays from "date-holidays";
import { prisma } from "@/lib/prisma";

const hd = new Holidays("BR");

/**
 * Garante que os feriados nacionais de um ano estejam na tabela Holiday.
 * Idempotente: se já existir algum feriado NACIONAL nesse ano, não faz nada
 * (assim a gestão pode editar/excluir sem que a gente recrie por baixo).
 */
export async function ensureNationalHolidaysSeeded(year: number): Promise<void> {
  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const existing = await prisma.holiday.count({
    where: { scope: "NACIONAL", date: { gte: yearStart, lte: yearEnd } },
  });
  if (existing > 0) return;

  const holidays = hd.getHolidays(year).filter((h) => h.type === "public");

  const rows = holidays.map((h) => {
    const [y, m, d] = h.date.split(" ")[0].split("-").map(Number);
    return {
      date: new Date(Date.UTC(y, m - 1, d, 12, 0, 0)),
      name: h.name,
      scope: "NACIONAL",
      type: "FOLGA",
    };
  });

  if (rows.length > 0) {
    await prisma.holiday.createMany({ data: rows });
  }
}

/** Garante que os anos cobertos por um intervalo de datas tenham feriados nacionais carregados. */
export async function ensureNationalHolidaysSeededForRange(start: Date, end: Date): Promise<void> {
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  for (let y = startYear; y <= endYear; y++) {
    await ensureNationalHolidaysSeeded(y);
  }
}
