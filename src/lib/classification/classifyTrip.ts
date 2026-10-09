import { dateKeyUTC, getBusinessWindow, type HolidayInfo } from "./businessHours";
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

function isNonWorkday(day: Date, holidayMap: HolidayMap): boolean {
  return getBusinessWindow(day, holidayMap.get(dateKeyUTC(day)) ?? null) == null;
}

// Regra: só fim de semana e feriado contam como uso pessoal. Qualquer dia útil é profissional,
// independente do horário.
function classifySameDayTrip(start: Date, holidayMap: HolidayMap): ClassificationResult {
  if (!isNonWorkday(start, holidayMap)) {
    return { classification: "PROFISSIONAL", reason: "Dia útil" };
  }
  const holiday = holidayMap.get(dateKeyUTC(start)) ?? null;
  const weekday = start.getUTCDay();
  const reason = holiday
    ? `Feriado: ${holiday.name}`
    : weekday === 0 || weekday === 6
      ? `Fim de semana (${weekdayName(start)})`
      : "Dia sem expediente";
  return { classification: "PESSOAL", reason };
}

export function classifyTrip(
  startDateTime: Date,
  endDateTime: Date,
  holidayMap: HolidayMap
): ClassificationResult {
  if (sameCalendarDayUTC(startDateTime, endDateTime)) {
    return classifySameDayTrip(startDateTime, holidayMap);
  }

  // Trajeto atravessa a meia-noite (ou mais dias): só dá pra classificar sozinho se todos os dias
  // forem do mesmo tipo. Misturando dia útil com fim de semana/feriado não dá pra separar os km
  // a partir do relatório, então cai em análise.
  const days: Date[] = [];
  const cursor = new Date(
    Date.UTC(startDateTime.getUTCFullYear(), startDateTime.getUTCMonth(), startDateTime.getUTCDate())
  );
  while (cursor <= endDateTime) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (days.every((day) => isNonWorkday(day, holidayMap))) {
    return { classification: "PESSOAL", reason: "Todos os dias do trajeto são fim de semana/feriado" };
  }
  if (days.every((day) => !isNonWorkday(day, holidayMap))) {
    return { classification: "PROFISSIONAL", reason: "Todos os dias do trajeto são dias úteis" };
  }
  return { classification: "EM_ANALISE", reason: "Trajeto mistura dia útil com fim de semana/feriado" };
}
