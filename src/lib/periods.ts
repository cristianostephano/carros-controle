import { lastBusinessDayOfMonth } from "@/lib/holidays";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Regra combinada com o usuário: a 1ª quinzena vai sempre do dia 1 ao dia 15;
 * a 2ª quinzena vai do dia 16 até o último dia útil do mês (não fim de semana,
 * não feriado nacional).
 */
export function generateFortnightPeriods(
  year: number,
  month1to12: number
): { startDate: Date; endDate: Date; label: string }[] {
  const firstHalfStart = new Date(Date.UTC(year, month1to12 - 1, 1, 12, 0, 0));
  const firstHalfEnd = new Date(Date.UTC(year, month1to12 - 1, 15, 12, 0, 0));

  const secondHalfStart = new Date(Date.UTC(year, month1to12 - 1, 16, 12, 0, 0));
  const secondHalfEnd = lastBusinessDayOfMonth(year, month1to12);

  const mm = pad(month1to12);
  return [
    {
      startDate: firstHalfStart,
      endDate: firstHalfEnd,
      label: `01 a 15/${mm}/${year}`,
    },
    {
      startDate: secondHalfStart,
      endDate: secondHalfEnd,
      label: `16 a ${pad(secondHalfEnd.getUTCDate())}/${mm}/${year}`,
    },
  ];
}
