"use server";

import { prisma } from "@/lib/prisma";
import { classifyTrip } from "@/lib/classification/classifyTrip";
import { buildHolidayMap } from "@/lib/classification/buildHolidayMap";
import { ensureNationalHolidaysSeededForRange } from "@/lib/holidaySeed";
import { periodDayBounds } from "@/lib/dates";
import { getAdminName } from "@/lib/adminName";
import { getCurrentRateCentavosForVehicle } from "@/lib/reimbursement";
import { autoApprovalTripFields, AUTO_APPROVAL_LABEL } from "@/lib/autoApproval";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type Decision = "PESSOAL" | "PROFISSIONAL";

async function applyDecision(tripId: string, decision: Decision, note: string | null, isAdjustment: boolean) {
  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
  const adminName = await getAdminName();
  const newStatus = isAdjustment ? "AJUSTADO_PELA_GESTAO" : "APROVADO_PELA_GESTAO";

  await prisma.trip.update({
    where: { id: tripId },
    data: {
      adminDecision: decision,
      adminDecisionNote: note,
      adminDecidedAt: new Date(),
      adminDecidedBy: adminName,
      status: newStatus,
      reimbursableKm: decision === "PESSOAL" ? trip.km : 0,
    },
  });

  await prisma.tripAuditLog.create({
    data: {
      tripId,
      action: isAdjustment ? "ADMIN_ADJUSTED" : "ADMIN_APPROVED",
      actorType: "ADMIN",
      actorLabel: adminName,
      previousValueJson: JSON.stringify({
        adminDecision: trip.adminDecision,
        status: trip.status,
      }),
      newValueJson: JSON.stringify({ adminDecision: decision, status: newStatus }),
      note,
    },
  });
}

/** Aprova a viagem confirmando a classificação automática (ou a declaração do vendedor, quando houver). */
export async function approveTrip(tripId: string) {
  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
  const suggestion = trip.salespersonDeclaration ?? trip.autoClassification;
  if (suggestion !== "PESSOAL" && suggestion !== "PROFISSIONAL") {
    // "Em análise" (ou sem classificação) não é uma sugestão válida pra confirmar de um clique só —
    // a gestão precisa escolher explicitamente Pessoal ou Profissional pra esse caso.
    throw new Error("Essa viagem está em análise — escolha Pessoal ou Profissional manualmente.");
  }
  await applyDecision(tripId, suggestion, null, false);
  revalidatePath(`/periodos/${trip.periodId}`, "layout");
}

/** A gestão define manualmente a classificação final, sobrepondo a automática/declarada. */
export async function adjustTrip(tripId: string, decision: Decision, note: string) {
  await applyDecision(tripId, decision, note || null, true);
  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
  revalidatePath(`/periodos/${trip.periodId}`, "layout");
}

export async function bulkApprove(periodId: string, tripIds: string[]) {
  for (const tripId of tripIds) {
    const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
    const decision = (trip.salespersonDeclaration ?? trip.autoClassification) as Decision;
    if (decision !== "PESSOAL" && decision !== "PROFISSIONAL") continue; // não aprova "Em análise" em lote sem decisão explícita
    await applyDecision(tripId, decision, null, false);
  }
  revalidatePath(`/periodos/${periodId}`, "layout");
}

export async function bulkSetDecision(periodId: string, tripIds: string[], decision: Decision) {
  for (const tripId of tripIds) {
    await applyDecision(tripId, decision, "Ajuste em lote pela gestão", true);
  }
  revalidatePath(`/periodos/${periodId}`, "layout");
}

/**
 * Reaplica a regra de classificação automática a todas as viagens do período
 * (útil depois de cadastrar um feriado/exceção novo, ou depois da Fase 1 onde
 * tudo ficou "Não classificado").
 */
export async function reclassifyPeriod(periodId: string) {
  const period = await prisma.period.findUniqueOrThrow({ where: { id: periodId } });
  const { start, end } = periodDayBounds(period);
  await ensureNationalHolidaysSeededForRange(start, end);
  const holidayMap = await buildHolidayMap(start, end);

  const trips = await prisma.trip.findMany({ where: { periodId } });

  for (const trip of trips) {
    const { classification, reason } = classifyTrip(trip.startDateTime, trip.endDateTime, holidayMap);
    const classificationChanged =
      classification !== trip.autoClassification || reason !== trip.autoClassificationReason;

    const wasAutoDecision = trip.adminDecidedBy === AUTO_APPROVAL_LABEL;
    const autoApproval = autoApprovalTripFields(classification);
    // "!trip.adminDecision" pega tanto reclassificações quanto o preenchimento retroativo de
    // viagens antigas que já eram profissionais mas nunca tinham sido aprovadas (por terem sido
    // importadas antes desta regra existir) — por isso não pode depender de classificationChanged.
    const shouldApprove = !!autoApproval && (!trip.adminDecision || wasAutoDecision);
    const shouldRevertApproval = !autoApproval && wasAutoDecision;

    if (!classificationChanged && !shouldApprove && !shouldRevertApproval) continue;

    const updateData: Record<string, unknown> = {};
    if (classificationChanged) {
      updateData.autoClassification = classification;
      updateData.autoClassificationReason = reason;
    }
    let approvalNote: string | null = null;

    if (shouldApprove) {
      // Profissional (novo ou já era) e ninguém decidiu manualmente ainda — aprova
      // (ou reafirma a aprovação) automaticamente.
      Object.assign(updateData, autoApproval);
      approvalNote = "Aprovado automaticamente por ser dia útil";
    } else if (shouldRevertApproval) {
      // Deixou de ser profissional (ex: virou feriado) e a aprovação era só automática —
      // volta pra fila de revisão da gestão em vez de ficar aprovado indevidamente.
      updateData.adminDecision = null;
      updateData.adminDecisionNote = null;
      updateData.adminDecidedAt = null;
      updateData.adminDecidedBy = null;
      updateData.status = "AGUARDANDO_DEVOLUTIVA";
      updateData.reimbursableKm = null;
      approvalNote = "Aprovação automática desfeita — deixou de ser dia útil";
    }
    // Se havia decisão manual de um admin de verdade, não mexemos nela aqui.

    await prisma.trip.update({ where: { id: trip.id }, data: updateData });
    if (classificationChanged) {
      await prisma.tripAuditLog.create({
        data: {
          tripId: trip.id,
          action: "AUTO_CLASSIFIED",
          actorType: "SYSTEM",
          previousValueJson: JSON.stringify({
            classification: trip.autoClassification,
            reason: trip.autoClassificationReason,
          }),
          newValueJson: JSON.stringify({ classification, reason }),
          note: "Reclassificação manual disparada pela gestão",
        },
      });
    }
    if (approvalNote) {
      await prisma.tripAuditLog.create({
        data: {
          tripId: trip.id,
          action: "AUTO_APPROVED",
          actorType: "SYSTEM",
          note: approvalNote,
        },
      });
    }
  }

  revalidatePath(`/periodos/${periodId}`);
}

/**
 * Fecha o período: trava a tarifa vigente e o valor de cada viagem já decidida
 * pela gestão (não muda mais mesmo que a tarifa seja alterada depois), bloqueia
 * os links dos vendedores e marca as viagens decididas como "Fechado". Viagens
 * ainda sem decisão da gestão ficam como estavam (não travam, não têm valor).
 */
export async function closePeriod(periodId: string) {
  const adminName = await getAdminName();

  const trips = await prisma.trip.findMany({
    where: { periodId, adminDecision: { not: null } },
  });

  for (const trip of trips) {
    const rate = await getCurrentRateCentavosForVehicle(trip.vehicleId);
    const tripValueCentavos =
      trip.adminDecision === "PESSOAL" && rate != null
        ? Math.round((trip.reimbursableKm ?? 0) * rate)
        : 0;

    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        rateAppliedCentavos: rate,
        tripValueCentavos,
        status: "FECHADO",
      },
    });

    await prisma.tripAuditLog.create({
      data: {
        tripId: trip.id,
        action: "PERIOD_CLOSED",
        actorType: "ADMIN",
        actorLabel: adminName,
        newValueJson: JSON.stringify({ rateAppliedCentavos: rate, tripValueCentavos }),
      },
    });
  }

  await prisma.period.update({
    where: { id: periodId },
    data: { status: "CLOSED", closedAt: new Date(), closedBy: adminName },
  });

  await prisma.salespersonAccessLink.updateMany({
    where: { periodId },
    data: { locked: true },
  });

  revalidatePath(`/periodos/${periodId}`, "layout");
  redirect(`/periodos/${periodId}`);
}

/** Reabre um período fechado — os valores travados ficam pendentes de novo até o próximo fechamento. */
export async function reopenPeriod(periodId: string) {
  const adminName = await getAdminName();

  const trips = await prisma.trip.findMany({ where: { periodId, status: "FECHADO" } });
  for (const trip of trips) {
    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        status: "AJUSTADO_PELA_GESTAO",
        rateAppliedCentavos: null,
        tripValueCentavos: null,
      },
    });
    await prisma.tripAuditLog.create({
      data: {
        tripId: trip.id,
        action: "PERIOD_REOPENED",
        actorType: "ADMIN",
        actorLabel: adminName,
      },
    });
  }

  await prisma.period.update({
    where: { id: periodId },
    data: { status: "REOPENED", closedAt: null, closedBy: null },
  });

  await prisma.salespersonAccessLink.updateMany({
    where: { periodId },
    data: { locked: false },
  });

  revalidatePath(`/periodos/${periodId}`, "layout");
}
