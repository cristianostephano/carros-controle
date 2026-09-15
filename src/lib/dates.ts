/**
 * Convenção deste projeto: todo horário do relatório do rastreador é hora local do Brasil
 * (sem horário de verão desde 2019). Para evitar que o fuso horário do navegador/servidor
 * reinterprete esses horários, guardamos e exibimos tudo usando os componentes UTC do Date
 * (getUTCHours, etc.) como se fossem a própria hora local — nunca getHours()/toLocaleString()
 * sem especificar timeZone: "UTC".
 */

const WEEKDAYS_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function parseBrDate(dataDDMMYYYY: string): { day: number; month: number; year: number } {
  const [d, m, y] = dataDDMMYYYY.trim().split("/").map(Number);
  return { day: d, month: m, year: y };
}

export function combineBrDateAndTime(
  dataDDMMYYYY: string,
  time: { h: number; m: number; s: number }
): Date {
  const { day, month, year } = parseBrDate(dataDDMMYYYY);
  return new Date(Date.UTC(year, month - 1, day, time.h, time.m, time.s));
}

export function timeOfDayFromCell(value: unknown): { h: number; m: number; s: number } {
  if (value instanceof Date) {
    return { h: value.getUTCHours(), m: value.getUTCMinutes(), s: value.getUTCSeconds() };
  }
  if (typeof value === "string") {
    const [h, m, s] = value.trim().split(":").map(Number);
    return { h: h || 0, m: m || 0, s: s || 0 };
  }
  return { h: 0, m: 0, s: 0 };
}

/** Duração em segundos a partir de uma célula de horário decorrido (pode passar de 24h). */
export function durationSecondsFromCell(value: unknown): number | null {
  if (value instanceof Date) {
    const epoch = Date.UTC(1899, 11, 30, 0, 0, 0);
    return Math.round((value.getTime() - epoch) / 1000);
  }
  if (typeof value === "string" && value.includes(":")) {
    const parts = value.trim().split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  return null;
}

export function formatDateBR(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

export function formatTimeBR(date: Date): string {
  const h = String(date.getUTCHours()).padStart(2, "0");
  const m = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function formatDateTimeBR(date: Date): string {
  return `${formatDateBR(date)} ${formatTimeBR(date)}`;
}

export function formatWeekdayBR(date: Date): string {
  return WEEKDAYS_PT[date.getUTCDay()];
}

export function formatDurationHMS(totalSeconds: number | null): string {
  if (totalSeconds == null) return "-";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Início (00:00:00) e fim (23:59:59.999) do dia calendário de uma data, em UTC. */
export function utcDayBounds(date: Date): { start: Date; end: Date } {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  return {
    start: new Date(Date.UTC(y, m, d, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m, d, 23, 59, 59, 999)),
  };
}

/** Intervalo de dias (início do primeiro dia ao fim do último dia) que um período cobre. */
export function periodDayBounds(period: { startDate: Date; endDate: Date }): {
  start: Date;
  end: Date;
} {
  return {
    start: utcDayBounds(period.startDate).start,
    end: utcDayBounds(period.endDate).end,
  };
}

export function sameCalendarDayUTC(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}
