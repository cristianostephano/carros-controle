import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  parseTrackerExcelRows,
  computeImportWarnings,
  type ImportWarning,
} from "@/lib/excel/parseTrackerExcel";
import { classifyTrip } from "@/lib/classification/classifyTrip";
import { buildHolidayMap } from "@/lib/classification/buildHolidayMap";
import { periodDayBounds } from "@/lib/dates";
import { ensureNationalHolidaysSeededForRange } from "@/lib/holidaySeed";
import { autoApprovalTripFields } from "@/lib/autoApproval";

const SEM_VENDEDOR_NICKNAME = "(Sem vendedor identificado)";

export async function runImport(params: {
  periodId: string;
  buffer: Buffer;
  fileName: string;
}): Promise<{ importId: string }> {
  const { periodId, buffer, fileName } = params;

  const period = await prisma.period.findUniqueOrThrow({ where: { id: periodId } });
  const { start, end } = periodDayBounds(period);
  await ensureNationalHolidaysSeededForRange(start, end);
  const holidayMap = await buildHolidayMap(start, end);

  const fileHash = createHash("sha256").update(buffer).digest("hex");
  const { rows: allRows } = await parseTrackerExcelRows(buffer);

  // O rastreador do usuário só exporta o histórico inteiro (todos os veículos,
  // desde sempre), então cada arquivo enviado é sempre filtrado para as datas
  // do período atual antes de qualquer outra coisa.
  const inPeriodRows = allRows.filter((r) => r.startDateTime >= start && r.startDateTime <= end);
  const outOfPeriodCount = allRows.length - inPeriodRows.length;

  // Como o mesmo arquivo (crescendo com o tempo) é reenviado a cada quinzena,
  // detectamos duplicidade por viagem (veículo + início + fim), não pelo arquivo inteiro.
  const existingTrips = await prisma.trip.findMany({
    where: { periodId },
    include: { vehicle: { select: { plate: true } } },
  });
  const existingKeys = new Set(
    existingTrips.map(
      (t) => `${t.vehicle.plate}|${t.startDateTime.getTime()}|${t.endDateTime.getTime()}`
    )
  );

  const newRows = inPeriodRows.filter(
    (r) => !existingKeys.has(`${r.veiculoRaw}|${r.startDateTime.getTime()}|${r.endDateTime.getTime()}`)
  );
  const alreadyImportedCount = inPeriodRows.length - newRows.length;

  const warnings: ImportWarning[] = computeImportWarnings(newRows);
  if (outOfPeriodCount > 0) {
    warnings.push({
      code: "FORA_DO_PERIODO",
      message: `${outOfPeriodCount} trajeto(s) do arquivo estavam fora das datas deste período e foram ignorados (normal ao reenviar o histórico completo).`,
    });
  }
  if (alreadyImportedCount > 0) {
    warnings.push({
      code: "JA_IMPORTADO_ANTES",
      message: `${alreadyImportedCount} trajeto(s) já haviam sido importados antes neste período e foram ignorados.`,
    });
  }
  const semVendedorCount = newRows.filter((r) => !r.apelidoRaw).length;
  if (semVendedorCount > 0) {
    warnings.push({
      code: "SEM_VENDEDOR",
      message: `${semVendedorCount} trajeto(s) sem vendedor identificado na planilha — agrupados em "${SEM_VENDEDOR_NICKNAME}".`,
    });
  }
  if (newRows.length === 0) {
    warnings.push({
      code: "NENHUMA_VIAGEM_NOVA",
      message: "Nenhuma viagem nova encontrada para este período neste arquivo.",
    });
  }

  const dates = newRows.map((r) => r.startDateTime.getTime());
  const dataRangeStart = dates.length ? new Date(Math.min(...dates)) : null;
  const dataRangeEnd = dates.length ? new Date(Math.max(...dates)) : null;

  const importRecord = await prisma.import.create({
    data: {
      periodId,
      fileName,
      fileHash,
      rowCount: newRows.length,
      dataRangeStart,
      dataRangeEnd,
      status: "PENDING_PREVIEW",
      warningsJson: JSON.stringify(warnings),
    },
  });

  // Resolve veículos e vendedores únicos primeiro (upsert uma vez cada, não uma vez por linha)
  const vehicleIdByPlate = new Map<string, string>();
  for (const plate of new Set(newRows.map((r) => r.veiculoRaw))) {
    const vehicle = await prisma.vehicle.upsert({ where: { plate }, create: { plate }, update: {} });
    vehicleIdByPlate.set(plate, vehicle.id);
  }
  const salespersonIdByNickname = new Map<string, string>();
  for (const nickname of new Set(newRows.map((r) => r.apelidoRaw || SEM_VENDEDOR_NICKNAME))) {
    const salesperson = await prisma.salesperson.upsert({
      where: { nickname },
      create: { nickname },
      update: {},
    });
    salespersonIdByNickname.set(nickname, salesperson.id);
  }

  // Grava tudo em lote (createMany) em vez de linha a linha, senão um período com
  // milhares de trajetos demora minutos só na importação.
  const rawRowData = [];
  const tripData = [];
  const auditData = [];
  for (const row of newRows) {
    const rawId = randomUUID();
    const tripId = randomUUID();
    const { classification, reason } = classifyTrip(row.startDateTime, row.endDateTime, holidayMap);

    rawRowData.push({
      id: rawId,
      importId: importRecord.id,
      rowNumber: row.rowNumber,
      rawRowJson: row.rawRowJson,
      veiculoRaw: row.veiculoRaw,
      apelidoRaw: row.apelidoRaw,
      motoristasRaw: row.motoristasRaw,
      dataInicioRaw: row.dataInicioRaw,
      horaInicioRaw: row.horaInicioRaw,
      odometroInicioRaw: row.odometroInicioRaw,
      dataFimRaw: row.dataFimRaw,
      horaFimRaw: row.horaFimRaw,
      odometroFimRaw: row.odometroFimRaw,
      enderecoInicioRaw: row.enderecoInicioRaw,
      latInicioRaw: row.latInicioRaw,
      lonInicioRaw: row.lonInicioRaw,
      enderecoFimRaw: row.enderecoFimRaw,
      latFimRaw: row.latFimRaw,
      lonFimRaw: row.lonFimRaw,
      kmRaw: row.kmRaw,
      tempoRaw: row.tempoRaw,
      litrosRaw: row.litrosRaw,
      custoRaw: row.custoRaw,
      velocidadeMaxRaw: row.velocidadeMaxRaw,
    });

    const autoApproval = autoApprovalTripFields(classification, row.km);

    tripData.push({
      id: tripId,
      rawTripRowId: rawId,
      periodId,
      vehicleId: vehicleIdByPlate.get(row.veiculoRaw)!,
      salespersonId: salespersonIdByNickname.get(row.apelidoRaw || SEM_VENDEDOR_NICKNAME)!,
      startDateTime: row.startDateTime,
      endDateTime: row.endDateTime,
      originAddress: row.enderecoInicioRaw,
      originLat: row.originLat,
      originLon: row.originLon,
      destAddress: row.enderecoFimRaw,
      destLat: row.destLat,
      destLon: row.destLon,
      km: row.km,
      durationSeconds: row.durationSeconds,
      autoClassification: classification,
      autoClassificationReason: reason,
      status: autoApproval?.status ?? "AGUARDANDO_DEVOLUTIVA",
      adminDecision: autoApproval?.adminDecision ?? null,
      adminDecidedAt: autoApproval?.adminDecidedAt ?? null,
      adminDecidedBy: autoApproval?.adminDecidedBy ?? null,
      reimbursableKm: autoApproval?.reimbursableKm ?? null,
    });

    auditData.push({
      id: randomUUID(),
      tripId,
      action: "AUTO_CLASSIFIED",
      actorType: "SYSTEM",
      newValueJson: JSON.stringify({ classification, reason }),
    });
    if (autoApproval) {
      auditData.push({
        id: randomUUID(),
        tripId,
        action: "AUTO_APPROVED",
        actorType: "SYSTEM",
        newValueJson: JSON.stringify({ adminDecision: autoApproval.adminDecision }),
        note:
          autoApproval.adminDecision === "PESSOAL"
            ? "Confirmado automaticamente como pessoal (fim de semana, feriado ou virada de meia-noite)"
            : "Confirmado automaticamente como profissional (dia útil)",
      });
    }
  }

  if (rawRowData.length > 0) {
    await prisma.rawTripRow.createMany({ data: rawRowData });
    await prisma.trip.createMany({ data: tripData });
    await prisma.tripAuditLog.createMany({ data: auditData });
  }

  return { importId: importRecord.id };
}
