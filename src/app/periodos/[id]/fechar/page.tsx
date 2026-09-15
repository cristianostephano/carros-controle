import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDateBR } from "@/lib/dates";
import { formatCentavosAsReais } from "@/lib/money";
import { closePeriod, reopenPeriod } from "../actions";

export default async function FecharPeriodoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: periodId } = await params;
  const period = await prisma.period.findUnique({ where: { id: periodId } });
  if (!period) notFound();

  const trips = await prisma.trip.findMany({
    where: { periodId },
    include: { salesperson: true, vehicle: { include: { model: true } } },
  });

  const pendentes = trips.filter((t) => !t.adminDecision).length;
  const isClosed = period.status === "CLOSED";

  const now = new Date();
  const rateByModelId = new Map<string, number | null>();
  for (const t of trips) {
    const modelId = t.vehicle.modelId;
    if (!modelId || rateByModelId.has(modelId)) continue;
    const rate = await prisma.rate.findFirst({
      where: { modelId, effectiveDate: { lte: now } },
      orderBy: { effectiveDate: "desc" },
    });
    rateByModelId.set(modelId, rate?.ratePerKmCentavos ?? null);
  }

  type Summary = { nickname: string; kmPessoal: number; valorCentavos: number };
  const bySalesperson = new Map<string, Summary>();
  for (const t of trips) {
    if (t.adminDecision !== "PESSOAL") continue;
    const km = t.reimbursableKm ?? t.km ?? 0;
    const valorCentavos = isClosed
      ? t.tripValueCentavos ?? 0
      : (() => {
          const rate = t.vehicle.modelId ? rateByModelId.get(t.vehicle.modelId) : null;
          return rate ? Math.round(km * rate) : 0;
        })();

    const key = t.salespersonId;
    if (!bySalesperson.has(key)) {
      bySalesperson.set(key, { nickname: t.salesperson.nickname, kmPessoal: 0, valorCentavos: 0 });
    }
    const entry = bySalesperson.get(key)!;
    entry.kmPessoal += km;
    entry.valorCentavos += valorCentavos;
  }

  const summary = [...bySalesperson.values()].sort((a, b) => b.valorCentavos - a.valorCentavos);
  const totalValor = summary.reduce((acc, s) => acc + s.valorCentavos, 0);

  async function closeAction() {
    "use server";
    await closePeriod(periodId);
  }
  async function reopenAction() {
    "use server";
    await reopenPeriod(periodId);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold">
        {isClosed ? "Período fechado" : "Fechar período"} — {period.label}
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        {formatDateBR(period.startDate)} a {formatDateBR(period.endDate)} · Status: {period.status}
        {period.closedAt && ` · Fechado em ${formatDateBR(period.closedAt)}${period.closedBy ? ` por ${period.closedBy}` : ""}`}
      </p>

      {!isClosed && pendentes > 0 && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {pendentes} viagem(ns) ainda sem decisão da gestão. Elas não vão entrar no valor a reembolsar e
          continuam pendentes mesmo depois de fechar. Revise antes se possível.
        </div>
      )}

      <div className="mb-6 rounded-md border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-600">
          {isClosed ? "Consolidado final" : "Prévia do consolidado (valores ainda não travados)"}
        </h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b">
            <tr className="text-zinc-500">
              <th className="py-2 font-medium">Vendedor</th>
              <th className="py-2 font-medium">Km pessoal confirmado</th>
              <th className="py-2 font-medium">Valor a reembolsar</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.nickname} className="border-b last:border-0">
                <td className="py-2">{s.nickname}</td>
                <td className="py-2">{s.kmPessoal.toFixed(2)} km</td>
                <td className="py-2">R$ {formatCentavosAsReais(s.valorCentavos)}</td>
              </tr>
            ))}
            {summary.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-zinc-500">
                  Nenhuma viagem pessoal confirmada ainda.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="py-2">Total</td>
              <td className="py-2"></td>
              <td className="py-2">R$ {formatCentavosAsReais(totalValor)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex gap-3">
        {isClosed ? (
          <form action={reopenAction}>
            <button
              type="submit"
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Reabrir período
            </button>
          </form>
        ) : (
          <form action={closeAction}>
            <button
              type="submit"
              className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-light"
            >
              Confirmar fechamento
            </button>
          </form>
        )}
        {isClosed && (
          <a
            href={`/periodos/${periodId}/exportar`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Exportar Excel
          </a>
        )}
        <Link
          href={`/periodos/${periodId}`}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
