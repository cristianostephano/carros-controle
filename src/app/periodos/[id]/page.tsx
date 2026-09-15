import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDateBR } from "@/lib/dates";
import { reclassifyPeriod } from "./actions";
import { KmPorDiaChart, KmPorVendedorChart } from "@/components/period-charts";
import { Badge, DashboardCard, StatTile } from "@/components/dashboard-ui";
import { formatCentavosAsReais } from "@/lib/money";
import { periodDayBounds } from "@/lib/dates";
import { buildHolidayMap } from "@/lib/classification/buildHolidayMap";
import { classifyOffHoursBucket } from "@/lib/classification/offHoursBreakdown";

const STATUS_OPTIONS = [
  { value: "AGUARDANDO_DEVOLUTIVA", label: "Aguardando devolutiva" },
  { value: "RESPONDIDO_PELO_VENDEDOR", label: "Respondido pelo vendedor" },
  { value: "APROVADO_PELA_GESTAO", label: "Aprovado" },
  { value: "AJUSTADO_PELA_GESTAO", label: "Ajustado" },
  { value: "FECHADO", label: "Fechado" },
];

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
  let trajetosForaDoExpediente = 0;

  const kmPorVendedorMap = new Map<string, number>();
  const kmPessoalPorVendedorMap = new Map<string, number>();
  const kmPorVeiculoMap = new Map<string, number>();
  const kmPorDiaMap = new Map<string, number>();
  const pendentesPorVendedor = new Map<string, number>();

  const { start: periodStart, end: periodEnd } = periodDayBounds(period);
  const holidayMap = await buildHolidayMap(periodStart, periodEnd);
  const kmFimDeSemanaPorVendedor = new Map<string, number>();
  const kmAposExpedientePorVendedor = new Map<string, number>();
  const kmFimDeSemanaTotalPorVendedor = new Map<string, number>();
  const kmAposExpedienteTotalPorVendedor = new Map<string, number>();
  let excedenteAguardandoVendedor = 0;
  let excedenteAguardandoGestao = 0;

  for (const t of trips) {
    const km = t.km ?? 0;
    kmTotal += km;
    if (t.autoClassification !== "PROFISSIONAL") trajetosForaDoExpediente += 1;

    if (t.adminDecision === "PESSOAL") {
      kmPessoalConfirmado += km;
      const rate = t.vehicle.modelId ? rateByModelId.get(t.vehicle.modelId) : null;
      if (rate) valorTotalReembolsarCentavos += Math.round((t.reimbursableKm ?? km) * rate);
      kmPessoalPorVendedorMap.set(
        t.salesperson.nickname,
        (kmPessoalPorVendedorMap.get(t.salesperson.nickname) ?? 0) + km
      );
    } else if (t.adminDecision === "PROFISSIONAL") {
      kmProfissional += km;
    } else if (t.autoClassification === "PROFISSIONAL") {
      kmProfissional += km;
    } else {
      kmEmAnaliseOuPendente += km;
      if (t.autoClassification === "PESSOAL" || t.autoClassification === "NAO_CLASSIFICADO") {
        kmPessoalPorVendedorMap.set(
          t.salesperson.nickname,
          (kmPessoalPorVendedorMap.get(t.salesperson.nickname) ?? 0) + km
        );
      }
    }

    if (!t.adminDecision) {
      pendentesPorVendedor.set(t.salesperson.nickname, (pendentesPorVendedor.get(t.salesperson.nickname) ?? 0) + 1);
    }

    kmPorVendedorMap.set(t.salesperson.nickname, (kmPorVendedorMap.get(t.salesperson.nickname) ?? 0) + km);
    kmPorVeiculoMap.set(t.vehicle.plate, (kmPorVeiculoMap.get(t.vehicle.plate) ?? 0) + km);
    const day = formatDateBR(t.startDateTime);
    kmPorDiaMap.set(day, (kmPorDiaMap.get(day) ?? 0) + km);

    // Km excedente: acompanhamos o total geral (histórico, pra referência) e, separado,
    // só o que ainda não tem decisão final da gestão (o que realmente precisa de atenção
    // — depois de confirmado, o km já conta nos totais acima e sai da lista de pendentes).
    const offHoursBucket = classifyOffHoursBucket(t.startDateTime, holidayMap);
    if (offHoursBucket === "FIM_DE_SEMANA_FERIADO" || offHoursBucket === "APOS_EXPEDIENTE") {
      const totalMap = offHoursBucket === "FIM_DE_SEMANA_FERIADO"
        ? kmFimDeSemanaTotalPorVendedor
        : kmAposExpedienteTotalPorVendedor;
      totalMap.set(t.salesperson.nickname, (totalMap.get(t.salesperson.nickname) ?? 0) + km);

      if (!t.adminDecision) {
        const pendingMap = offHoursBucket === "FIM_DE_SEMANA_FERIADO"
          ? kmFimDeSemanaPorVendedor
          : kmAposExpedientePorVendedor;
        pendingMap.set(t.salesperson.nickname, (pendingMap.get(t.salesperson.nickname) ?? 0) + km);

        if (!t.salespersonDeclaration) {
          excedenteAguardandoVendedor += 1;
        } else {
          excedenteAguardandoGestao += 1;
        }
      }
    }
  }

  const kmPorVendedor = [...kmPorVendedorMap.entries()]
    .map(([name, km]) => ({ name, km }))
    .sort((a, b) => b.km - a.km);
  const topVendedoresPessoal = [...kmPessoalPorVendedorMap.entries()]
    .map(([name, km]) => ({ name, km }))
    .sort((a, b) => b.km - a.km);
  const topVeiculos = [...kmPorVeiculoMap.entries()]
    .map(([plate, km]) => ({ plate, km }))
    .sort((a, b) => b.km - a.km);
  const kmPorDia = [...kmPorDiaMap.entries()].map(([day, km]) => ({ day, km }));
  const vendedoresPendentes = [...pendentesPorVendedor.entries()].sort((a, b) => b[1] - a[1]);

  const kmExcedentePorVendedor = salespeople
    .map((s) => {
      const kmFimDeSemana = kmFimDeSemanaPorVendedor.get(s.nickname) ?? 0;
      const kmAposExpediente = kmAposExpedientePorVendedor.get(s.nickname) ?? 0;
      const kmFimDeSemanaTotal = kmFimDeSemanaTotalPorVendedor.get(s.nickname) ?? 0;
      const kmAposExpedienteTotal = kmAposExpedienteTotalPorVendedor.get(s.nickname) ?? 0;
      return {
        nickname: s.nickname,
        kmFimDeSemana,
        kmAposExpediente,
        kmFimDeSemanaTotal,
        kmAposExpedienteTotal,
        kmTotalPendente: kmFimDeSemana + kmAposExpediente,
        kmTotalGeral: kmFimDeSemanaTotal + kmAposExpedienteTotal,
      };
    })
    .filter((v) => v.kmTotalGeral > 0)
    .sort((a, b) => b.kmTotalGeral - a.kmTotalGeral);

  const kmExcedenteSomatoria = kmExcedentePorVendedor.reduce(
    (acc, v) => ({
      kmFimDeSemanaTotal: acc.kmFimDeSemanaTotal + v.kmFimDeSemanaTotal,
      kmAposExpedienteTotal: acc.kmAposExpedienteTotal + v.kmAposExpedienteTotal,
      kmTotalGeral: acc.kmTotalGeral + v.kmTotalGeral,
      kmFimDeSemana: acc.kmFimDeSemana + v.kmFimDeSemana,
      kmAposExpediente: acc.kmAposExpediente + v.kmAposExpediente,
      kmTotalPendente: acc.kmTotalPendente + v.kmTotalPendente,
    }),
    {
      kmFimDeSemanaTotal: 0,
      kmAposExpedienteTotal: 0,
      kmTotalGeral: 0,
      kmFimDeSemana: 0,
      kmAposExpediente: 0,
      kmTotalPendente: 0,
    }
  );

  const pendingImports = period.imports.filter((i) => i.status === "PENDING_PREVIEW");

  async function reclassifyAction() {
    "use server";
    await reclassifyPeriod(id);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{period.label}</h1>
          <p className="text-sm text-zinc-500">
            {formatDateBR(period.startDate)} a {formatDateBR(period.endDate)} · Status: {period.status}
          </p>
        </div>
        <div className="flex gap-3">
          <form action={reclassifyAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Reclassificar viagens
            </button>
          </form>
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
            <StatTile value={`${kmTotal.toFixed(0)}`} label="Km total" color="navy" />
            <StatTile value={`${kmProfissional.toFixed(0)}`} label="Km profissional" color="emerald" />
            <StatTile value={`${kmPessoalConfirmado.toFixed(0)}`} label="Km pessoal confirmado" color="amber" />
            <StatTile value={`${kmEmAnaliseOuPendente.toFixed(0)}`} label="Km em análise/pendente" color="rose" />
          </div>
        </DashboardCard>
        <DashboardCard title="Reembolso e filtro atual" icon={<CashIcon />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile value={`R$ ${formatCentavosAsReais(valorTotalReembolsarCentavos)}`} label="Valor a reembolsar" color="emerald" />
            <StatTile value={String(trajetosForaDoExpediente)} label="Fora do expediente" color="violet" />
            <StatTile value={String(trips.length)} label="Viagens no filtro" color="navy" />
            <StatTile value={String(salespeople.length)} label="Vendedores" color="zinc" />
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

      {/* Top listas */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <DashboardCard title="Km pessoal por vendedor" icon={<UsersIcon />} href={`/periodos/${id}/pessoal`}>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {topVendedoresPessoal.map((v) => (
              <li key={v.name} className="flex justify-between">
                <span>{v.name}</span>
                <span className="font-medium">{v.km.toFixed(1)} km</span>
              </li>
            ))}
            {topVendedoresPessoal.length === 0 && <li className="text-zinc-400">Nenhum</li>}
          </ul>
        </DashboardCard>
        <DashboardCard title="Km por veículo" icon={<CarSmallIcon />}>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {topVeiculos.map((v) => (
              <li key={v.plate} className="flex justify-between">
                <span>{v.plate}</span>
                <span className="font-medium">{v.km.toFixed(1)} km</span>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Vendedores com viagens pendentes"
          icon={<AlertIcon />}
          badge={vendedoresPendentes.length > 0 ? <Badge tone="amber">{vendedoresPendentes.length}</Badge> : undefined}
          href={`/periodos/${id}/vendedores`}
        >
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {vendedoresPendentes.map(([name, count]) => (
              <li key={name} className="flex justify-between">
                <span>{name}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {count}
                </span>
              </li>
            ))}
            {vendedoresPendentes.length === 0 && <li className="text-zinc-400">Nenhum</li>}
          </ul>
        </DashboardCard>
      </div>

      {/* Km excedente por vendedor */}
      <DashboardCard
        title="Km excedente por vendedor"
        icon={<AlertIcon />}
        badge={
          excedenteAguardandoVendedor + excedenteAguardandoGestao > 0 ? (
            <Badge tone="amber">{excedenteAguardandoVendedor + excedenteAguardandoGestao}</Badge>
          ) : (
            <Badge tone="emerald">OK</Badge>
          )
        }
      >
        <p className="mb-3 text-xs text-zinc-400">
          Km rodado fora do expediente (fim de semana/feriado, ou depois do fim do expediente do dia). As
          colunas &ldquo;total&rdquo; somam pendente + já decidido pela gestão (fim de semana + após
          expediente = total geral). As colunas &ldquo;pendente&rdquo; são o subconjunto que{" "}
          <strong>ainda não tem decisão final da gestão</strong> — assim que confirmada (pessoal ou
          profissional), a viagem sai do pendente e passa a contar nos totais do painel.
        </p>
        {(excedenteAguardandoVendedor > 0 || excedenteAguardandoGestao > 0) && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Ainda há {excedenteAguardandoVendedor} viagem(ns) excedente(s) aguardando resposta do vendedor e{" "}
            {excedenteAguardandoGestao} aguardando revisão da gestão.
          </div>
        )}
        {kmExcedentePorVendedor.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhum km excedente no filtro atual.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b">
              <tr className="text-zinc-400">
                <th className="py-1"></th>
                <th className="py-1 text-center font-medium" colSpan={3}>
                  Total (pendente + decidido)
                </th>
                <th className="py-1 text-center font-medium" colSpan={3}>
                  Só pendente
                </th>
              </tr>
              <tr className="border-b text-zinc-500">
                <th className="py-2 font-medium">Vendedor</th>
                <th className="py-2 font-medium">Fim de semana/feriado</th>
                <th className="py-2 font-medium">Após expediente</th>
                <th className="py-2 font-medium">Total geral</th>
                <th className="py-2 font-medium">Fim de semana/feriado</th>
                <th className="py-2 font-medium">Após expediente</th>
                <th className="py-2 font-medium">Total pendente</th>
              </tr>
            </thead>
            <tbody>
              {kmExcedentePorVendedor.map((v) => (
                <tr key={v.nickname} className="border-b last:border-0">
                  <td className="py-2">{v.nickname}</td>
                  <td className="py-2">{v.kmFimDeSemanaTotal.toFixed(1)} km</td>
                  <td className="py-2">{v.kmAposExpedienteTotal.toFixed(1)} km</td>
                  <td className="py-2 font-medium">{v.kmTotalGeral.toFixed(1)} km</td>
                  <td className="py-2 text-amber-700">{v.kmFimDeSemana.toFixed(1)} km</td>
                  <td className="py-2 text-amber-700">{v.kmAposExpediente.toFixed(1)} km</td>
                  <td className="py-2 font-medium text-amber-700">{v.kmTotalPendente.toFixed(1)} km</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="py-2">Total</td>
                <td className="py-2">{kmExcedenteSomatoria.kmFimDeSemanaTotal.toFixed(1)} km</td>
                <td className="py-2">{kmExcedenteSomatoria.kmAposExpedienteTotal.toFixed(1)} km</td>
                <td className="py-2">{kmExcedenteSomatoria.kmTotalGeral.toFixed(1)} km</td>
                <td className="py-2 text-amber-700">{kmExcedenteSomatoria.kmFimDeSemana.toFixed(1)} km</td>
                <td className="py-2 text-amber-700">{kmExcedenteSomatoria.kmAposExpediente.toFixed(1)} km</td>
                <td className="py-2 text-amber-700">{kmExcedenteSomatoria.kmTotalPendente.toFixed(1)} km</td>
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
function CarSmallIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M5 17h14M5 17a2 2 0 1 0 4 0m6 0a2 2 0 1 0 4 0M5 17V9l2-4h10l2 4v8" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 10v4M12 17h.01" />
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
