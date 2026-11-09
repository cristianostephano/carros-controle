import Holidays from "date-holidays";

const hd = new Holidays("BR");

/**
 * Só considera feriados nacionais "public" (Ano Novo, Tiradentes, etc.) como sem
 * expediente. Feriados móveis do tipo "optional"/"bank" (ex: Carnaval, Corpus
 * Christi) não bloqueiam dia útil por padrão — ajustar aqui quando a gestão
 * decidir como tratar esses dias facultativos.
 */
export function isNationalHoliday(date: Date): boolean {
  const result = hd.isHoliday(date);
  if (!result) return false;
  const list = Array.isArray(result) ? result : [result];
  return list.some((h) => h.type === "public");
}

export function isBusinessDay(date: Date): boolean {
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !isNationalHoliday(date);
}

/** O próprio dia, se for útil; senão o próximo dia útil (pula fim de semana e feriado nacional). */
export function nextBusinessDayOnOrAfter(date: Date): Date {
  let d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));
  while (!isBusinessDay(d)) {
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 12, 0, 0));
  }
  return d;
}
