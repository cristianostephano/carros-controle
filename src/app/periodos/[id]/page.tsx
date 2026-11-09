import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDateBR } from "@/lib/dates";
import { ReclassifyButton } from "@/components/reclassify-button";
import { KmPorDiaChart, KmPorVendedorChart } from "@/components/period-charts";
import { DashboardCard, StatTile } from "@/components/dashboard-ui";
import { formatCentavosAsReais } from "@/lib/money";
import { rhDeliveryDate } from "@/lib/periods";

const STATUS_OPTIONS = [
  { value: "AGUARDANDO_DEVOLUTIVA", label: "Aguardando devolutiva" },
  { value: "RESPONDIDO_PELO_VENDEDOR", label: "Respondido pelo vendedor" },
  { value: "APROVADO_PELA_GESTAO", label: "Aprovado" },
  { value: "AJUSTADO_PELA_GESTAO", label: "Ajustado" },
  { value: "FECHADO", label: "Fechado" },
];

// Reclassificar viagens roda a partir desta página e pode demorar em quinzenas grandes.
export const maxDuration = 60;

export default async function PeriodoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vendedor?: string; veiculo?: string; status?: string }>;
}) {
  const { id } = await params;
  const { vendedor, veiculo, status } = await searchParams;

  const period = await prisma.period.findUnique({
    where: { id },
    include: { imports: { orderBy: { importedAt: "desc" } } },
  });
  if (!period) notFound();

  const allTrips = await prisma.trip.findMany({
    where: { periodId: id, rawTripRow: { import: { status: "CONFIRMED" } } },
    include: { vehicle: { include: { model: true } }, salesperson: true },
    orderBy: { startDateTime: "asc" },
  });

  const salespeople = [...new Map(allTrips.map((t) => [t.salespersonId, t.salesperson])).values()].sort(
    (a, b) => a.nickname.localeCompare(b.nickname)
  );
  const vehicles = [...new Map(allTrips.map((t) => [t.vehicleId, t.vehicle])).values()].sort((a, b) =>
    a.plate.localeCompare(b.plate)
  );

  const trips = allTrips.filter(
    (t) =>
      (!vendedor || t.salespersonId === vendedor) &&
      (!veiculo || t.vehicleId === veiculo) &&
      (!status || t.status === status)
  );

  // Tarifa vigente por modelo (cache simples nesta requisição)
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

  let kmTotal = 0;
  let kmProfissional = 0;
  let kmPessoalConfirmado = 0;
  let kmEmAnaliseOuPendente = 0;
  let valorTotalReembolsarCentavos = 0;
  let kmAReembolsar = 0;

  type ResumoVendedor = { viagens: number; kmTotal: number; kmProfissional: number; kmPessoal: number };
  const resumoPorVendedor = new Map<string, ResumoVendedor>();
  const kmPorDiaMap = new Map<string, number>();

  for (const t of trips) {
    const km = t.km ?? 0;
    kmTotal += km;

    const resumo = resumoPorVendedor.get(t.salesperson.nickname) ?? {
      viagens: 0,
      kmTotal: 0,
      kmProfissional: 0,
      kmPessoal: 0,
    };
    resumo.viagens += 1;
    resumo.kmTotal += km;

    if (t.adminDecision === "PESSOAL") {
      kmPessoalConfirmado += km;
      kmAReembolsar += t.reimbursableKm ?? km;
      resumo.kmPessoal += km;
      const rate = t.vehicle.modelId ? rateByModelId.get(t.vehicle.modelId) : null;
      if (rate) valorTotalReembolsarCentavos += Math.round((t.reimbursableKm ?? km) * rate);
    } else if (t.adminDecision === "PROFISSIONAL" || (!t.adminDecision && t.autoClassification === "PROFISSIONAL")) {
      kmProfissional += km;
      resumo.kmProfissional += km;
    } else {
      kmEmAnaliseOuPendente += km;
      if (t.autoClassification === "PESSOAL" || t.autoClassification === "NAO_CLASSIFICADO") {
        resumo.kmPessoal += km;
      }
    }
    resumoPorVendedor.set(t.salesperson.nickname, resumo);

    const day = formatDateBR(t.startDateTime);
    kmPorDiaMap.set(day, (kmPorDiaMap.get(day) ?? 0) + km);
  }

  const resumoVendedores = [...resumoPorVendedor.entries()]
    .map(([nickname, r]) => ({ nickname, ...r }))
    .sort((x, y) => y.kmTotal - x.kmTotal);
  const resumoSomatoria = resumoVendedores.reduce(
    (acc, v) => ({
      viagens: acc.viagens + v.viagens,
      kmTotal: acc.kmTotal + v.kmTotal,
      kmProfissional: acc.kmProfissional + v.kmProfissional,
      kmPessoal: acc.kmPessoal + v.kmPessoal,
    }),
    { viagens: 0, kmTotal: 0, kmProfissional: 0, kmPessoal: 0 }
  );
  const kmPorVendedor = resumoVendedores.map((v) => ({ name: v.nickname, km: v.kmTotal }));
  const kmPorDia = [...kmPorDiaMap.entries()].map(([day, km]) => ({ day, km }));

  const pendingImports = period.imports.filter((i) => i.status === "PENDING_PREVIEW");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{period.label}</h1>
          <p className="text-sm text-zinc-500">
            {formatDateBR(period.startDate)} a {formatDateBR(period.endDate)} · Status: {period.status}
          </p>
          {period.responseDeadline && (
            <p className="text-sm text-zinc-500">
              Vendedores ajustam até {formatDateBR(period.responseDeadline)} · Entrega ao RH:{" "}
              <span className="font-medium text-zinc-700">{formatDateBR(rhDeliveryDate(period.responseDeadline))}</span>
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <ReclassifyButton periodId={id} />
          <Link
            href={`/periodos/${id}/vendedores`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Revisar por vendedor
          </Link>
          <Link
            href={`/periodos/${id}/pessoal`}
            className="rounded-md border border-amber-400 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
          >
            Uso pessoal
          </Link>
          <Link
            href={`/periodos/${id}/fechar`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {period.status === "CLOSED" ? "Ver fechamento" : "Fechar período"}
          </Link>
          <Link
            href={`/periodos/${id}/importar`}
            className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-light"
          >
            Importar planilha
          </Link>
        </div>
      </div>

      {pendingImports.length > 0 && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">Importações aguardando confirmação</h2>
          <ul className="space-y-1 text-sm">
            {pendingImports.map((imp) => (
              <li key={imp.id}>
                <Link href={`/periodos/${id}/importacoes/${imp.id}`} className="text-amber-900 underline">
                  {imp.fileName} — {imp.rowCount} viagens (ver prévia)
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filtros */}
      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-md border bg-white p-4 text-sm">
        <label className="flex flex-col gap-1">
          Vendedor
          <select name="vendedor" defaultValue={vendedor ?? ""} className="rounded-md border px-2 py-1">
            <option value="">Todos</option>
            {salespeople.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nickname}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Veículo
          <select name="veiculo" defaultValue={veiculo ?? ""} className="rounded-md border px-2 py-1">
            <option value="">Todos</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Status
          <select name="status" defaultValue={status ?? ""} className="rounded-md border px-2 py-1">
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-brand-navy px-4 py-1.5 text-white hover:bg-brand-navy-light">
          Filtrar
        </button>
        {(vendedor || veiculo || status) && (
          <Link href={`/periodos/${id}`} className="text-zinc-500 underline">
            limpar filtros
          </Link>
        )}
      </form>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <DashboardCard title="Km rodado no período" icon={<KmIcon />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile value={`${kmTotal.toFixed(0)}`} label="Km total" />
            <StatTile value={`${kmProfissional.toFixed(0)}`} label="Km profissional" />
            <StatTile value={`${kmPessoalConfirmado.toFixed(0)}`} label="Km pessoal confirmado" />
            <StatTile value={`${kmEmAnaliseOuPendente.toFixed(0)}`} label="Km em análise/pendente" />
          </div>
        </DashboardCard>
        <DashboardCard title="Reembolso e filtro atual" icon={<CashIcon />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile value={`R$ ${formatCentavosAsReais(valorTotalReembolsarCentavos)}`} label="Valor a reembolsar" />
            <StatTile value={`${kmAReembolsar.toFixed(0)}`} label="Km a reembolsar" />
            <StatTile value={String(trips.length)} label="Viagens no filtro" />
            <StatTile value={String(salespeople.length)} label="Vendedores" />
          </div>
        </DashboardCard>
      </div>

      {/* Gráficos */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <DashboardCard title="Km por vendedor" icon={<ChartIcon />}>
          <KmPorVendedorChart data={kmPorVendedor} />
        </DashboardCard>
        <DashboardCard title="Km por dia" icon={<ChartIcon />}>
          <KmPorDiaChart data={kmPorDia} />
        </DashboardCard>
      </div>

      {/* Resumo detalhado por vendedor */}
      <DashboardCard title="Resumo por vendedor" icon={<UsersIcon />} href={`/periodos/${id}/pessoal`} hrefLabel="Ver uso pessoal">
        {resumoVendedores.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhuma viagem no filtro atual.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b text-zinc-500">
                  <th className="py-2 font-medium">Vendedor</th>
                  <th className="py-2 text-right font-medium">Viagens</th>
                  <th className="py-2 text-right font-medium">Km total</th>
                  <th className="py-2 text-right font-medium">Km profissional</th>
                  <th className="py-2 text-right font-medium">Km pessoal</th>
                </tr>
              </thead>
              <tbody>
                {resumoVendedores.map((v) => (
                  <tr key={v.nickname} className="border-b last:border-0">
                    <td className="py-2">{v.nickname}</td>
                    <td className="py-2 text-right">{v.viagens}</td>
                    <td className="py-2 text-right font-medium">{v.kmTotal.toFixed(1)} km</td>
                    <td className="py-2 text-right">{v.kmProfissional.toFixed(1)} km</td>
                    <td className="py-2 text-right">{v.kmPessoal.toFixed(1)} km</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right">{resumoSomatoria.viagens}</td>
                  <td className="py-2 text-right">{resumoSomatoria.kmTotal.toFixed(1)} km</td>
                  <td className="py-2 text-right">{resumoSomatoria.kmProfissional.toFixed(1)} km</td>
                  <td className="py-2 text-right">{resumoSomatoria.kmPessoal.toFixed(1)} km</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </DashboardCard>

      {period.imports.length > 0 && (
        <div className="mt-4">
          <DashboardCard title="Histórico de importações" icon={<FileIcon />}>
            <ul className="divide-y text-sm">
              {period.imports.map((imp) => (
                <li key={imp.id} className="flex items-center justify-between py-2">
                  <span>{imp.fileName}</span>
                  <span className="flex items-center gap-3 text-zinc-500">
                    {imp.rowCount} linhas · {imp.status}
                    <Link href={`/periodos/${id}/importacoes/${imp.id}`} className="underline">
                      ver
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </DashboardCard>
        </div>
      )}
    </div>
  );
}

function iconProps(className = "h-4 w-4") {
  return { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className };
}
function KmIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M5 17h14M5 17a2 2 0 1 0 4 0m6 0a2 2 0 1 0 4 0M5 17V9l2-4h10l2 4v8" />
    </svg>
  );
}
function CashIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 19V5M4 19h16M8 15v-4m4 4V8m4 7v-6" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M17 8a3 3 0 1 1-3-3M15 20a6 6 0 0 0-1.5-8" />
    </svg>
  );
}
function FileIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M6 2h9l5 5v15H6V2z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
