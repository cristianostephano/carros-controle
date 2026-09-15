import { prisma } from "@/lib/prisma";
import { formatDateBR } from "@/lib/dates";
import Link from "next/link";

export default async function PeriodosPage() {
  const periods = await prisma.period.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { trips: true, imports: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Períodos (quinzenas)</h1>
        <Link
          href="/periodos/novo"
          className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-light"
        >
          Novo período
        </Link>
      </div>

      {periods.length === 0 ? (
        <p className="text-zinc-500">Nenhum período criado ainda.</p>
      ) : (
        <ul className="divide-y rounded-md border bg-white">
          {periods.map((p) => (
            <li key={p.id}>
              <Link
                href={`/periodos/${p.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50"
              >
                <div>
                  <div className="font-medium">{p.label}</div>
                  <div className="text-sm text-zinc-500">
                    {formatDateBR(p.startDate)} a {formatDateBR(p.endDate)}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-500">
                  <span>{p._count.trips} viagens</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium">
                    {p.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
