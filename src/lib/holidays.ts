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

/** Último dia útil (não fim de semana, não feriado nacional) de um mês (1-12). */
export function lastBusinessDayOfMonth(year: number, month1to12: number): Date {
  let d = new Date(Date.UTC(year, month1to12, 0, 12, 0, 0)); // dia 0 do próximo mês = último dia deste mês
  while (!isBusinessDay(d)) {
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 1, 12, 0, 0));
  }
  return d;
}
