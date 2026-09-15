import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { VendorTripTable, type VendorTripRow } from "@/components/vendor-trip-table";
import { VendorLinkCard } from "@/components/vendor-link-card";
import { getCurrentRateCentavosForVehicle } from "@/lib/reimbursement";
import { generateOrGetLink } from "./actions";

export default async function VendorReviewPage({
  params,
}: {
  params: Promise<{ id: string; salespersonId: string }>;
}) {
  const { id: periodId, salespersonId } = await params;

  const [period, salesperson] = await Promise.all([
    prisma.period.findUnique({ where: { id: periodId } }),
    prisma.salesperson.findUnique({ where: { id: salespersonId } }),
  ]);
  if (!period || !salesperson) notFound();

  const trips = await prisma.trip.findMany({
    where: { periodId, salespersonId },
    include: { vehicle: true, auditLogs: { orderBy: { createdAt: "asc" } } },
    orderBy: { startDateTime: "asc" },
  });

  const rateCache = new Map<string, number | null>();
  const rows: VendorTripRow[] = [];
  for (const t of trips) {
    if (!rateCache.has(t.vehicleId)) {
      rateCache.set(t.vehicleId, await getCurrentRateCentavosForVehicle(t.vehicleId));
    }
    rows.push({
      id: t.id,
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
      rateCentavos: rateCache.get(t.vehicleId) ?? null,
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

  const plates = [...new Set(trips.map((t) => t.vehicle.plate))];
  const totalKm = trips.reduce((acc, t) => acc + (t.km ?? 0), 0);

  const link = await generateOrGetLink(periodId, salespersonId);

  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${proto}://${host}` : "";

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold">{salesperson.nickname}</h1>
      <p className="mb-6 text-sm text-zinc-500">
        {period.label} · Veículo(s): {plates.join(", ") || "-"} · {trips.length} viagens · {totalKm.toFixed(1)} km
        total
      </p>

      <VendorLinkCard
        periodId={periodId}
        salespersonId={salespersonId}
        salespersonName={salesperson.nickname}
        periodStart={period.startDate}
        periodEnd={period.endDate}
        token={link.token}
        baseUrl={baseUrl}
        expiresAt={link.expiresAt}
        locked={link.locked}
        submittedAt={link.submittedAt}
      />

      <VendorTripTable periodId={periodId} rows={rows} />
    </div>
  );
}
