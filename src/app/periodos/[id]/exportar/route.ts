import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { formatDateBR, formatTimeBR } from "@/lib/dates";
import { getCurrentRateCentavosForVehicle } from "@/lib/reimbursement";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: periodId } = await params;

  const period = await prisma.period.findUnique({ where: { id: periodId } });
  if (!period) {
    return NextResponse.json({ error: "Período não encontrado" }, { status: 404 });
  }

  const trips = await prisma.trip.findMany({
    where: { periodId, adminDecision: "PESSOAL" },
    include: { salesperson: true, vehicle: { include: { model: true } } },
    orderBy: [{ salesperson: { nickname: "asc" } }, { startDateTime: "asc" }],
  });

  const isClosed = period.status === "CLOSED";
  const rateCache = new Map<string, number | null>();
  const resolveRate = async (vehicleId: string) => {
    if (!rateCache.has(vehicleId)) {
      rateCache.set(vehicleId, await getCurrentRateCentavosForVehicle(vehicleId));
    }
    return rateCache.get(vehicleId) ?? null;
  };

  type Row = {
    nickname: string;
    plate: string;
    modelName: string;
    startDateTime: Date;
    endDateTime: Date;
    originAddress: string | null;
    destAddress: string | null;
    km: number;
    autoClassification: string;
    justification: string | null;
    reimbursableKm: number;
    rateCentavos: number | null;
    valueCentavos: number;
  };

  const rows: Row[] = [];
  for (const t of trips) {
    const rateCentavos = isClosed ? t.rateAppliedCentavos : await resolveRate(t.vehicleId);
    const reimbursableKm = t.reimbursableKm ?? t.km ?? 0;
    const valueCentavos = isClosed
      ? t.tripValueCentavos ?? 0
      : rateCentavos
        ? Math.round(reimbursableKm * rateCentavos)
        : 0;

    rows.push({
      nickname: t.salesperson.nickname,
      plate: t.vehicle.plate,
      modelName: t.vehicle.model?.name ?? "-",
      startDateTime: t.startDateTime,
      endDateTime: t.endDateTime,
      originAddress: t.originAddress,
      destAddress: t.destAddress,
      km: t.km ?? 0,
      autoClassification: t.autoClassification,
      justification: t.adminDecisionNote ?? t.salespersonJustification,
      reimbursableKm,
      rateCentavos,
      valueCentavos,
    });
  }

  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet("Resumo por vendedor");
  summarySheet.columns = [
    { header: "Vendedor", key: "nickname", width: 30 },
    { header: "Km pessoal confirmado", key: "km", width: 20 },
    { header: "Tarifa (R$/km)", key: "rate", width: 16 },
    { header: "Valor a reembolsar (R$)", key: "value", width: 20 },
  ];
  const bySalesperson = new Map<string, { km: number; value: number; rates: Set<number> }>();
  for (const r of rows) {
    if (!bySalesperson.has(r.nickname)) bySalesperson.set(r.nickname, { km: 0, value: 0, rates: new Set() });
    const entry = bySalesperson.get(r.nickname)!;
    entry.km += r.reimbursableKm;
    entry.value += r.valueCentavos;
    if (r.rateCentavos != null) entry.rates.add(r.rateCentavos);
  }
  let totalKm = 0;
  let totalValue = 0;
  for (const [nickname, entry] of [...bySalesperson.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    totalKm += entry.km;
    totalValue += entry.value;
    summarySheet.addRow({
      nickname,
      km: Number(entry.km.toFixed(2)),
      rate: entry.rates.size === 1 ? (([...entry.rates][0] ?? 0) / 100).toFixed(2) : "várias",
      value: (entry.value / 100).toFixed(2),
    });
  }
  summarySheet.addRow({});
  summarySheet.addRow({ nickname: "Total", km: Number(totalKm.toFixed(2)), value: (totalValue / 100).toFixed(2) });
  summarySheet.getRow(1).font = { bold: true };

  const detailSheet = workbook.addWorksheet("Detalhe dos trajetos");
  detailSheet.columns = [
    { header: "Vendedor", key: "nickname", width: 26 },
    { header: "Veículo", key: "plate", width: 12 },
    { header: "Modelo", key: "modelName", width: 16 },
    { header: "Data", key: "date", width: 12 },
    { header: "Hora início", key: "startTime", width: 12 },
    { header: "Hora fim", key: "endTime", width: 12 },
    { header: "Origem", key: "origin", width: 40 },
    { header: "Destino", key: "dest", width: 40 },
    { header: "Km", key: "km", width: 10 },
    { header: "Justificativa", key: "justification", width: 40 },
    { header: "Km reembolsável", key: "reimbursableKm", width: 16 },
    { header: "Tarifa (R$/km)", key: "rate", width: 14 },
    { header: "Valor (R$)", key: "value", width: 14 },
  ];
  for (const r of rows) {
    detailSheet.addRow({
      nickname: r.nickname,
      plate: r.plate,
      modelName: r.modelName,
      date: formatDateBR(r.startDateTime),
      startTime: formatTimeBR(r.startDateTime),
      endTime: formatTimeBR(r.endDateTime),
      origin: r.originAddress ?? "-",
      dest: r.destAddress ?? "-",
      km: r.km,
      justification: r.justification ?? "",
      reimbursableKm: Number(r.reimbursableKm.toFixed(2)),
      rate: r.rateCentavos != null ? (r.rateCentavos / 100).toFixed(2) : "-",
      value: (r.valueCentavos / 100).toFixed(2),
    });
  }
  detailSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `reembolso_${period.label.replace(/[^0-9a-zA-Z]+/g, "_")}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
