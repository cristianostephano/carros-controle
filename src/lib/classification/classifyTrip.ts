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

function hhmm(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

// Regra: fim de semana e feriado são pessoais; em dia útil, só o que fica inteiro dentro do
// horário de trabalho (padrão 06h às 20h) é profissional. Qualquer parte fora do horário é pessoal.
function classifySameDayTrip(start: Date, end: Date, holidayMap: HolidayMap): ClassificationResult {
  const holiday = holidayMap.get(dateKeyUTC(start)) ?? null;
  const window = getBusinessWindow(start, holiday);

  if (window == null) {
    const weekday = start.getUTCDay();
    const reason = holiday
      ? `Feriado: ${holiday.name}`
      : weekday === 0 || weekday === 6
        ? `Fim de semana (${weekdayName(start)})`
        : "Dia sem expediente";
    return { classification: "PESSOAL", reason };
  }

  const startMin = minutesOfDayUTC(start);
  const endMin = minutesOfDayUTC(end);
  const inside =
    startMin >= window.startMinutes && startMin <= window.endMinutes &&
    endMin >= window.startMinutes && endMin <= window.endMinutes;
  const label = `${hhmm(window.startMinutes)} às ${hhmm(window.endMinutes)}`;

  return inside
    ? { classification: "PROFISSIONAL", reason: `Dentro do horário de trabalho (${label})` }
    : { classification: "PESSOAL", reason: `Fora do horário de trabalho (${label})` };
}

export function classifyTrip(
  startDateTime: Date,
  endDateTime: Date,
  holidayMap: HolidayMap
): ClassificationResult {
  if (sameCalendarDayUTC(startDateTime, endDateTime)) {
    return classifySameDayTrip(startDateTime, endDateTime, holidayMap);
  }

  // Usar o carro na virada do dia (meia-noite) conta como uso pessoal.
  return { classification: "PESSOAL", reason: "Trajeto atravessa a meia-noite" };
}
