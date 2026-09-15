import { prisma } from "@/lib/prisma";

const DEFAULT_MODELS = ["Renault Kwid", "Fiat Mobi"];

/** Idempotente: cria os modelos padrão só se ainda não existir nenhum modelo cadastrado. */
export async function ensureDefaultVehicleModelsSeeded(): Promise<void> {
  const count = await prisma.vehicleModel.count();
  if (count > 0) return;

  for (const name of DEFAULT_MODELS) {
    await prisma.vehicleModel.upsert({ where: { name }, create: { name }, update: {} });
  }
}
