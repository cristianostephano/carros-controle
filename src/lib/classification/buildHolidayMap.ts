import { prisma } from "@/lib/prisma";
import { dateKeyUTC, parseHHMM } from "./businessHours";
import type { HolidayMap } from "./classifyTrip";

/** Monta o mapa de feriados/exceções (por dia) cobrindo um intervalo de datas. */
export async function buildHolidayMap(start: Date, end: Date): Promise<HolidayMap> {
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: start, lte: end } },
  });

  const map: HolidayMap = new Map();
  for (const h of holidays) {
    // Exceções manuais/municipais têm prioridade sobre feriado nacional no mesmo dia
    const key = dateKeyUTC(h.date);
    const existing = map.get(key);
    if (existing && existing.type === "DIA_UTIL_ESPECIAL" && h.scope === "NACIONAL") continue;

    map.set(key, {
      type: h.type as "FOLGA" | "DIA_UTIL_ESPECIAL",
      name: h.name,
      customWindow:
        h.customWindowStart && h.customWindowEnd
          ? { startMinutes: parseHHMM(h.customWindowStart), endMinutes: parseHHMM(h.customWindowEnd) }
          : null,
    });
  }
  return map;
}
