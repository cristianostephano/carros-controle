import { prisma } from "@/lib/prisma";

type ActorType = "SYSTEM" | "SALESPERSON" | "ADMIN";

export async function logTripAction(params: {
  tripId: string;
  action: string;
  actorType: ActorType;
  actorLabel?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  note?: string | null;
}) {
  await prisma.tripAuditLog.create({
    data: {
      tripId: params.tripId,
      action: params.action,
      actorType: params.actorType,
      actorLabel: params.actorLabel ?? null,
      previousValueJson: params.previousValue !== undefined ? JSON.stringify(params.previousValue) : null,
      newValueJson: params.newValue !== undefined ? JSON.stringify(params.newValue) : null,
      note: params.note ?? null,
    },
  });
}
