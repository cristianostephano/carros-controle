export type TimeWindow = { startMinutes: number; endMinutes: number };

export type HolidayInfo = {
  type: "FOLGA" | "DIA_UTIL_ESPECIAL";
  name: string;
  customWindow: TimeWindow | null;
};

// Horário de trabalho padrão de todos os vendedores: expediente (08h-18h) com 2h de folga antes e depois.
export const WORK_START_MINUTES = 6 * 60;
export const WORK_END_MINUTES = 20 * 60;
const DEFAULT_WINDOW: TimeWindow = { startMinutes: WORK_START_MINUTES, endMinutes: WORK_END_MINUTES };

export function dateKeyUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function minutesOfDayUTC(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
}

function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Expediente do dia, ou null se não houver expediente (fim de semana / feriado).
 * `holiday`, quando presente, é o registro de Holiday já resolvido para esse dia.
 */
export function getBusinessWindow(date: Date, holiday: HolidayInfo | null): TimeWindow | null {
  const weekday = date.getUTCDay();
  const isWeekend = weekday === 0 || weekday === 6;

  if (holiday?.type === "FOLGA") return null;

  if (holiday?.type === "DIA_UTIL_ESPECIAL") {
    if (holiday.customWindow) return holiday.customWindow;
    return DEFAULT_WINDOW;
  }

  if (isWeekend) return null;

  return DEFAULT_WINDOW; // seg-sex
}

export { parseHHMM };
