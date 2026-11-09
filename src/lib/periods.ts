import { lastBusinessDayOfMonth, nextBusinessDayOnOrAfter } from "@/lib/holidays";

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

/**
 * Ciclo mensal do RH: do dia 21 do mês anterior ao dia 20 do mês informado. O relatório é enviado
 * aos vendedores no dia 21, eles têm 2 dias (21 e 22) para ajustar, e o fechamento é no dia 23.
 */
export function generateMonthlyCyclePeriod(
  year: number,
  month1to12: number
): { startDate: Date; endDate: Date; label: string; responseDeadline: Date } {
  const startDate = new Date(Date.UTC(year, month1to12 - 2, 21, 12, 0, 0));
  const endDate = new Date(Date.UTC(year, month1to12 - 1, 20, 12, 0, 0));
  const startMonth = pad(startDate.getUTCMonth() + 1);
  const startPart =
    startDate.getUTCFullYear() === year ? `21/${startMonth}` : `21/${startMonth}/${startDate.getUTCFullYear()}`;
  return {
    startDate,
    endDate,
    label: `${startPart} a 20/${pad(month1to12)}/${year}`,
    responseDeadline: new Date(Date.UTC(year, month1to12 - 1, 22, 23, 59, 59)),
  };
}

/** Entrega do relatório ao RH: o dia do fechamento (dia seguinte ao prazo) ou o próximo dia útil. */
export function rhDeliveryDate(responseDeadline: Date): Date {
  const closingDay = new Date(
    Date.UTC(responseDeadline.getUTCFullYear(), responseDeadline.getUTCMonth(), responseDeadline.getUTCDate() + 1, 12, 0, 0)
  );
  return nextBusinessDayOnOrAfter(closingDay);
}
