"use server";

import { prisma } from "@/lib/prisma";
import { autoApprovalTripFields, pendingGestaoReviewFields, vendorPessoalAutoApprovalFields } from "@/lib/autoApproval";

export type TripResponse = {
  tripId: string;
  declaration: "PESSOAL" | "PROFISSIONAL";
};

export async function submitResponses(token: string, responses: TripResponse[]) {
  const link = await prisma.salespersonAccessLink.findUnique({ where: { token } });
  if (!link) throw new Error("Link inválido.");
  if (link.locked) throw new Error("Este link já foi bloqueado pela gestão.");
  if (link.expiresAt && link.expiresAt < new Date()) throw new Error("O prazo para responder já passou.");

  // Só aceita trajetos que realmente pertencem a este vendedor+período (nunca confiar no que vem do cliente)
  const trips = await prisma.trip.findMany({
    where: { periodId: link.periodId, salespersonId: link.salespersonId },
  });
  const tripById = new Map(trips.map((t) => [t.id, t]));

  for (const r of responses) {
    const trip = tripById.get(r.tripId);
    // Período já fechado trava os valores de vez — não deixa a resposta do vendedor
    // reabrir um trajeto cujo reembolso já foi calculado e congelado.
    if (!trip || trip.status === "FECHADO") continue;

    // Confiamos na palavra do vendedor: "pessoal" e "profissional dentro do
    // expediente" já entram aprovados direto, sem passar pela gestão. O único caso
    // que realmente precisa de revisão é "profissional" contrariando a sugestão (fim de semana/feriado) —
    // e isso vale mesmo que o trajeto já tivesse uma decisão anterior, porque a
    // resposta mais recente do vendedor é sempre a informação mais atual.
    const alwaysReview = trip.autoClassification === "EM_ANALISE";
    const decisionFields = alwaysReview
      ? pendingGestaoReviewFields()
      : r.declaration === "PESSOAL"
        ? vendorPessoalAutoApprovalFields(trip.km)
        : trip.autoClassification === "PROFISSIONAL"
          ? autoApprovalTripFields("PROFISSIONAL")!
          : pendingGestaoReviewFields();

    await prisma.trip.update({
      where: { id: r.tripId },
      data: {
        salespersonDeclaration: r.declaration,
        salespersonRespondedAt: new Date(),
        ...decisionFields,
      },
    });

    await prisma.tripAuditLog.create({
      data: {
        tripId: r.tripId,
        action: "SALESPERSON_DECLARED",
        actorType: "SALESPERSON",
        actorLabel: null,
        newValueJson: JSON.stringify({ declaration: r.declaration }),
      },
    });

    if (decisionFields.adminDecision) {
      await prisma.tripAuditLog.create({
        data: {
          tripId: r.tripId,
          action: "AUTO_APPROVED",
          actorType: "SYSTEM",
          note:
            r.declaration === "PESSOAL"
              ? "Aprovado automaticamente porque o vendedor declarou uso pessoal"
              : "Aprovado automaticamente por ser dia útil",
        },
      });
    } else {
      await prisma.tripAuditLog.create({
        data: {
          tripId: r.tripId,
          action: "AGUARDANDO_REVISAO",
          actorType: "SYSTEM",
          note: alwaysReview
            ? "Aguarda análise da gestão: trajeto atravessa a meia-noite"
            : "Volta para revisão da gestão: vendedor declarou profissional em fim de semana/feriado",
        },
      });
    }
  }

  await prisma.salespersonAccessLink.update({
    where: { token },
    data: { submittedAt: new Date(), lastAccessedAt: new Date() },
  });
}

export async function touchLinkAccess(token: string) {
  await prisma.salespersonAccessLink
    .update({ where: { token }, data: { lastAccessedAt: new Date() } })
    .catch(() => {});
}
