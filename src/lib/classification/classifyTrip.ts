import { dateKeyUTC, getBusinessWindow, minutesOfDayUTC, type HolidayInfo } from "./businessHours";
import { sameCalendarDayUTC } from "@/lib/dates";

export type AutoClassification = "PROFISSIONAL" | "PESSOAL" | "EM_ANALISE" | "NAO_CLASSIFICADO";

export type ClassificationResult = {
  classification: AutoClassification;
  reason: string;
};

/** Map de "YYYY-MM-DD" -> informação de feriado/exceção para esse dia. */
export type HolidayMap = Map<string, HolidayInfo>;

function weekdayName(date: Date): string {
  return date.getUTCDay() === 0 ? "domingo" : "sábado";
}

function classifySameDayTrip(start: Date, end: Date, holidayMap: HolidayMap): ClassificationResult {
  const holiday = holidayMap.get(dateKeyUTC(start)) ?? null;
  const window = getBusinessWindow(start, holiday);

  if (window == null) {
    const weekday = start.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const reason = holiday
      ? `Feriado: ${holiday.name}`
      : isWeekend
        ? `Fim de semana (${weekdayName(start)})`
        : "Sem expediente";
    return { classification: "PESSOAL", reason };
  }

  const startMin = minutesOfDayUTC(start);
  const endMin = minutesOfDayUTC(end);
  const startIn = startMin >= window.startMinutes && startMin <= window.endMinutes;
  const endIn = endMin >= window.startMinutes && endMin <= window.endMinutes;

  if (startIn && endIn) {
    return { classification: "PROFISSIONAL", reason: "Dentro do expediente" };
  }
  if (!startIn && !endIn) {
    if (startMin < window.startMinutes && endMin > window.endMinutes) {
      return { classification: "EM_ANALISE", reason: "Trajeto atravessa todo o expediente" };
    }
    return { classification: "PESSOAL", reason: "Fora do expediente" };
  }
  return { classification: "EM_ANALISE", reason: "Cruza limite do expediente" };
}

export function classifyTrip(
  startDateTime: Date,
  endDateTime: Date,
  holidayMap: HolidayMap
): ClassificationResult {
  if (sameCalendarDayUTC(startDateTime, endDateTime)) {
    return classifySameDayTrip(startDateTime, endDateTime, holidayMap);
  }

  // Trajeto atravessa a meia-noite (ou mais dias): só é "Pessoal" se TODOS os dias
  // envolvidos forem sem expediente; caso contrário não dá pra separar os km com
  // precisão a partir do relatório, então cai em análise.
  const days: Date[] = [];
  const cursor = new Date(startDateTime);
  while (cursor <= endDateTime) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const allNonBusiness = days.every((day) => {
    const holiday = holidayMap.get(dateKeyUTC(day)) ?? null;
    return getBusinessWindow(day, holiday) == null;
  });

  if (allNonBusiness) {
    return { classification: "PESSOAL", reason: "Todos os dias do trajeto são sem expediente" };
  }
  return { classification: "EM_ANALISE", reason: "Trajeto atravessa múltiplos dias" };
}
