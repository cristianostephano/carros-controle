import { dateKeyUTC, getBusinessWindow, minutesOfDayUTC } from "./businessHours";
import type { HolidayMap } from "./classifyTrip";

export type OffHoursBucket = "FIM_DE_SEMANA_FERIADO" | "APOS_EXPEDIENTE" | null;

/**
 * Classifica o INÍCIO de uma viagem em um dos dois "baldes" de km excedente que a
 * gestão pediu para acompanhar por vendedor:
 * - fim de semana ou feriado (o dia todo não tem expediente)
 * - depois do fim do expediente num dia útil (usa o horário de término de cada dia:
 *   18h seg-qui, 17h sexta — a mesma regra já usada na classificação automática)
 * Viagens dentro do expediente (ou que começam antes dele) não entram em nenhum balde.
 */
export function classifyOffHoursBucket(startDateTime: Date, holidayMap: HolidayMap): OffHoursBucket {
  const holiday = holidayMap.get(dateKeyUTC(startDateTime)) ?? null;
  const window = getBusinessWindow(startDateTime, holiday);

  if (window == null) {
    return "FIM_DE_SEMANA_FERIADO";
  }
  if (minutesOfDayUTC(startDateTime) > window.endMinutes) {
    return "APOS_EXPEDIENTE";
  }
  return null;
}
