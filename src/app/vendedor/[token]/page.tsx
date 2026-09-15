import { prisma } from "@/lib/prisma";
import { formatDateBR } from "@/lib/dates";
import { VendorResponseForm, type ResponseTripRow } from "@/components/vendor-response-form";
import { touchLinkAccess } from "./actions";

export default async function VendorTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const link = await prisma.salespersonAccessLink.findUnique({
    where: { token },
    include: { period: true, salesperson: true },
  });

  if (!link) {
    return (
      <Message title="Link inválido">
        Esse link não existe ou foi removido. Fale com a gestão para receber um link novo.
      </Message>
    );
  }

  const expired = link.expiresAt != null && link.expiresAt < new Date();

  if (link.locked || expired) {
    return (
      <Message title={link.locked ? "Link bloqueado" : "Prazo encerrado"}>
        {link.locked
          ? "A gestão encerrou as respostas deste período."
          : `O prazo para responder era ${link.expiresAt ? formatDateBR(link.expiresAt) : ""}. Fale com a gestão se precisar responder mesmo assim.`}
      </Message>
    );
  }

  await touchLinkAccess(token);

  const trips = await prisma.trip.findMany({
    where: { periodId: link.periodId, salespersonId: link.salespersonId },
    orderBy: { startDateTime: "asc" },
  });

  const rows: ResponseTripRow[] = trips.map((t) => ({
    id: t.id,
    startDateTime: t.startDateTime,
    endDateTime: t.endDateTime,
    originAddress: t.originAddress,
    destAddress: t.destAddress,
    km: t.km,
    autoClassification: t.autoClassification,
    autoClassificationReason: t.autoClassificationReason,
    salespersonDeclaration: t.salespersonDeclaration,
    adminDecision: t.adminDecision,
    // Só o fechamento do período trava de verdade (valores já calculados e congelados).
    // Uma decisão só da gestão/automática ainda pode ser trocada pelo próprio vendedor.
    locked: t.status === "FECHADO",
  }));

  const totalKm = trips.reduce((acc, t) => acc + (t.km ?? 0), 0);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="bg-brand-navy px-4 pb-5 pt-6 text-white">
        <div className="mx-auto max-w-lg">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-brand-yellow px-1.5 py-0.5 text-xs font-bold text-brand-navy">RAIAR</span>
            <span className="text-xs text-white/75">Gestão de Frota</span>
          </div>
          <h1 className="text-lg font-semibold">Olá, {link.salesperson.nickname}</h1>
          <p className="text-sm text-white/75">
            Período {link.period.label} · {trips.length} viagens · {totalKm.toFixed(1)} km total
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-lg px-4 pt-4">
        <p className="mb-2 text-sm text-zinc-600">
          Para cada trajeto abaixo, marque se o uso foi <strong>pessoal</strong> ou <strong>profissional</strong>.
          Mesmo os trajetos já revisados podem ser trocados, se necessário.
        </p>
      </div>
      <VendorResponseForm token={token} rows={rows} />
    </div>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-sm rounded-lg border bg-white p-6 text-center">
        <h1 className="mb-2 text-lg font-semibold">{title}</h1>
        <p className="text-sm text-zinc-500">{children}</p>
      </div>
    </div>
  );
}
