import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { confirmImports, deleteImports } from "../../importar/actions";
import { TripTable, type TripRowData } from "@/components/trip-table";
import type { ImportWarning } from "@/lib/excel/parseTrackerExcel";

export default async function ImportBatchPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ids?: string; falhas?: string }>;
}) {
  const { id: periodId } = await params;
  const { ids, falhas } = await searchParams;

  const importIds = ids ? ids.split(",").filter(Boolean) : [];
  const failures = falhas
    ? falhas.split("|").filter(Boolean).map((entry) => {
        const [fileName, ...rest] = entry.split(": ");
        return { fileName, error: rest.join(": ") };
      })
    : [];

  if (importIds.length === 0 && failures.length === 0) notFound();

  const period = await prisma.period.findUnique({ where: { id: periodId } });
  if (!period) notFound();

  const imports = await prisma.import.findMany({
    where: { id: { in: importIds }, periodId },
    include: {
      rawRows: {
        include: { trip: { include: { vehicle: true, salesperson: true } } },
        orderBy: { rowNumber: "asc" },
      },
    },
  });

  const alreadyConfirmed = imports.length > 0 && imports.every((i) => i.status === "CONFIRMED");

  const warnings: (ImportWarning & { fileName: string })[] = imports.flatMap((imp) => {
    const w: ImportWarning[] = imp.warningsJson ? JSON.parse(imp.warningsJson) : [];
    return w.map((warning) => ({ ...warning, fileName: imp.fileName }));
  });

  const rows: TripRowData[] = imports.flatMap((imp) =>
    imp.rawRows
      .filter((r) => r.trip)
      .map((r) => ({
        id: r.trip!.id,
        startDateTime: r.trip!.startDateTime,
        endDateTime: r.trip!.endDateTime,
        vehiclePlate: r.trip!.vehicle.plate,
        salespersonNickname: r.trip!.salesperson.nickname,
        originAddress: r.trip!.originAddress,
        destAddress: r.trip!.destAddress,
        km: r.trip!.km,
        durationSeconds: r.trip!.durationSeconds,
        autoClassification: r.trip!.autoClassification,
        autoClassificationReason: r.trip!.autoClassificationReason,
        status: r.trip!.status,
      }))
  );

  async function confirmAction() {
    "use server";
    await confirmImports(periodId, importIds);
  }
  async function deleteAction() {
    "use server";
    await deleteImports(periodId, importIds);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold">Prévia da importação em lote</h1>
      <p className="mb-6 text-sm text-zinc-500">
        {imports.length} arquivo(s) processado(s) com sucesso · Período: {period.label}
      </p>

      {failures.length > 0 && (
        <div className="mb-6 rounded-md border border-red-300 bg-red-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-red-900">
            {failures.length} arquivo(s) não puderam ser importados
          </h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-red-900">
            {failures.map((f, i) => (
              <li key={i}>
                <span className="font-medium">{f.fileName}</span>: {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {imports.length > 0 && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Arquivos" value={String(imports.length)} />
            <Stat label="Viagens encontradas" value={String(rows.length)} />
            <Stat
              label="Vendedores"
              value={String(new Set(rows.map((r) => r.salespersonNickname)).size)}
            />
            <Stat
              label="Km total"
              value={rows.reduce((acc, r) => acc + (r.km ?? 0), 0).toFixed(1)}
            />
          </div>

          {warnings.length > 0 && (
            <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-amber-900">Avisos</h2>
              <ul className="list-inside list-disc space-y-1 text-sm text-amber-900">
                {warnings.map((w, i) => (
                  <li key={i}>
                    <span className="font-medium">{w.fileName}</span>: {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-6">
            <TripTable data={rows} />
          </div>

          <div className="flex gap-3">
            {alreadyConfirmed ? (
              <span className="rounded-md bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800">
                Importação confirmada
              </span>
            ) : (
              <>
                <form action={confirmAction}>
                  <button
                    type="submit"
                    className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-light"
                  >
                    Confirmar todos os arquivos importados
                  </button>
                </form>
                <form action={deleteAction}>
                  <button
                    type="submit"
                    className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Excluir e importar de novo
                  </button>
                </form>
              </>
            )}
          </div>
        </>
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
