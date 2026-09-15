import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function VendedoresListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const period = await prisma.period.findUnique({ where: { id } });
  if (!period) notFound();

  const trips = await prisma.trip.findMany({
    where: { periodId: id },
    include: { salesperson: true, vehicle: true },
  });

  const bySalesperson = new Map<
    string,
    { name: string; plates: Set<string>; total: number; pendentes: number; km: number }
  >();
  for (const t of trips) {
    const key = t.salespersonId;
    if (!bySalesperson.has(key)) {
      bySalesperson.set(key, { name: t.salesperson.nickname, plates: new Set(), total: 0, pendentes: 0, km: 0 });
    }
    const entry = bySalesperson.get(key)!;
    entry.plates.add(t.vehicle.plate);
    entry.total += 1;
    entry.km += t.km ?? 0;
    if (!t.adminDecision) entry.pendentes += 1;
  }

  const vendors = [...bySalesperson.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vendedores — {period.label}</h1>
        <Link
          href={`/periodos/${id}/pessoal`}
          className="rounded-md border border-amber-400 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50"
        >
          Uso pessoal
        </Link>
      </div>
      <p className="mb-6 text-sm text-zinc-500">Escolha um vendedor para revisar as viagens dele neste período.</p>

      <div className="rounded-md border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-zinc-50">
            <tr>
              <th className="px-3 py-2 font-medium text-zinc-600">Vendedor</th>
              <th className="px-3 py-2 font-medium text-zinc-600">Veículo(s)</th>
              <th className="px-3 py-2 font-medium text-zinc-600">Viagens</th>
              <th className="px-3 py-2 font-medium text-zinc-600">Km total</th>
              <th className="px-3 py-2 font-medium text-zinc-600">Pendentes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vendors.map(([salespersonId, v]) => (
              <tr key={salespersonId} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{v.name}</td>
                <td className="px-3 py-2">{[...v.plates].join(", ")}</td>
                <td className="px-3 py-2">{v.total}</td>
                <td className="px-3 py-2">{v.km.toFixed(1)}</td>
                <td className="px-3 py-2">
                  {v.pendentes > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {v.pendentes} pendente(s)
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      Tudo revisado
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/periodos/${id}/vendedores/${salespersonId}`} className="text-zinc-600 underline">
                    revisar
                  </Link>
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-zinc-500">
                  Nenhuma viagem importada ainda neste período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
