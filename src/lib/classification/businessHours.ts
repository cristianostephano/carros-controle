export type TimeWindow = { startMinutes: number; endMinutes: number };

export type HolidayInfo = {
  type: "FOLGA" | "DIA_UTIL_ESPECIAL";
  name: string;
  customWindow: TimeWindow | null;
};

const DEFAULT_WINDOW_MON_THU: TimeWindow = { startMinutes: 8 * 60, endMinutes: 18 * 60 };
const DEFAULT_WINDOW_FRI: TimeWindow = { startMinutes: 8 * 60, endMinutes: 17 * 60 };

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
    return DEFAULT_WINDOW_MON_THU;
  }

  if (isWeekend) return null;

  if (weekday >= 1 && weekday <= 4) return DEFAULT_WINDOW_MON_THU; // seg-qui
  if (weekday === 5) return DEFAULT_WINDOW_FRI; // sex
  return null;
}

export { parseHHMM };
