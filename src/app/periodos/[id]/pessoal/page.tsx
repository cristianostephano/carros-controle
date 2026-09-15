import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { VendorTripTable, type VendorTripRow } from "@/components/vendor-trip-table";
import { getCurrentRateCentavosForVehicle } from "@/lib/reimbursement";
import { formatCentavosAsReais } from "@/lib/money";

export default async function UsoPessoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: periodId } = await params;
  const period = await prisma.period.findUnique({ where: { id: periodId } });
  if (!period) notFound();

  const trips = await prisma.trip.findMany({
    where: {
      periodId,
      rawTripRow: { import: { status: "CONFIRMED" } },
      OR: [
        { adminDecision: "PESSOAL" },
        { adminDecision: null, salespersonDeclaration: "PESSOAL" },
        { adminDecision: null, salespersonDeclaration: null, autoClassification: "PESSOAL" },
      ],
    },
    include: { salesperson: true, vehicle: true, auditLogs: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ salesperson: { nickname: "asc" } }, { startDateTime: "asc" }],
  });

  const rateCache = new Map<string, number | null>();
  const rows: VendorTripRow[] = [];
  let totalKm = 0;
  let totalValueCentavos = 0;
  let confirmedCount = 0;
  let pendingCount = 0;

  for (const t of trips) {
    if (!rateCache.has(t.vehicleId)) {
      rateCache.set(t.vehicleId, await getCurrentRateCentavosForVehicle(t.vehicleId));
    }
    const rateCentavos = rateCache.get(t.vehicleId) ?? null;
    const km = t.reimbursableKm ?? t.km ?? 0;
    totalKm += km;
    if (rateCentavos) totalValueCentavos += Math.round(km * rateCentavos);
    if (t.adminDecision === "PESSOAL") confirmedCount += 1;
    else pendingCount += 1;

    rows.push({
      id: t.id,
      salespersonName: t.salesperson.nickname,
      vehiclePlate: t.vehicle.plate,
      startDateTime: t.startDateTime,
      endDateTime: t.endDateTime,
      originAddress: t.originAddress,
      destAddress: t.destAddress,
      km: t.km,
      durationSeconds: t.durationSeconds,
      autoClassification: t.autoClassification,
      autoClassificationReason: t.autoClassificationReason,
      salespersonDeclaration: t.salespersonDeclaration,
      salespersonJustification: t.salespersonJustification,
      adminDecision: t.adminDecision,
      adminDecisionNote: t.adminDecisionNote,
      status: t.status,
      reimbursableKm: t.reimbursableKm,
      rateCentavos,
      auditLogs: t.auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        actorType: log.actorType,
        actorLabel: log.actorLabel,
        note: log.note,
        createdAt: log.createdAt,
      })),
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Uso pessoal — {period.label}</h1>
          <p className="text-sm text-zinc-500">
            Toda viagem marcada como pessoal (pelo sistema, pelo vendedor ou já aprovada pela gestão), de todos
            os vendedores, num lugar só.
          </p>
        </div>
        <Link
          href={`/periodos/${periodId}`}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Voltar ao painel
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Viagens" value={String(rows.length)} />
        <Stat label="Km total (pessoal)" value={`${totalKm.toFixed(1)} km`} />
        <Stat label="Valor estimado" value={`R$ ${formatCentavosAsReais(totalValueCentavos)}`} />
        <Stat label="Confirmadas / pendentes" value={`${confirmedCount} / ${pendingCount}`} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border bg-white p-6 text-center text-sm text-zinc-500">
          Nenhuma viagem pessoal (sugerida, declarada ou confirmada) neste período ainda.
        </div>
      ) : (
        <VendorTripTable periodId={periodId} rows={rows} showVendorColumn />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
