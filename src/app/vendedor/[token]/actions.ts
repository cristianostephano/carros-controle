"use server";

import { prisma } from "@/lib/prisma";
import { vendorPessoalAutoApprovalFields, vendorProfissionalApprovalFields } from "@/lib/autoApproval";

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

    // A palavra do vendedor é a realidade: pessoal ou profissional, a resposta já fica
    // aprovada direto, sem fila de revisão. A gestão só analisa o relatório final.
    // A resposta mais recente sempre vale, mesmo sobre uma decisão anterior.
    const decisionFields =
      r.declaration === "PESSOAL"
        ? vendorPessoalAutoApprovalFields(trip.km)
        : vendorProfissionalApprovalFields();

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

    await prisma.tripAuditLog.create({
      data: {
        tripId: r.tripId,
        action: "AUTO_APPROVED",
        actorType: "SYSTEM",
        note:
          r.declaration === "PESSOAL"
            ? "Aprovado automaticamente porque o vendedor declarou uso pessoal"
            : "Aprovado automaticamente porque o vendedor declarou uso profissional",
      },
    });
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
