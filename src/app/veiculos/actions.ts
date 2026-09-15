"use server";

import { prisma } from "@/lib/prisma";
import { parseReaisToCentavos } from "@/lib/money";
import { revalidatePath } from "next/cache";

function parseDateInput(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

export async function createVehicleModel(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Informe o nome do modelo.");
  await prisma.vehicleModel.upsert({ where: { name }, create: { name }, update: {} });
  revalidatePath("/veiculos");
}

export async function assignVehicleModel(formData: FormData) {
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const modelId = String(formData.get("modelId") ?? "");
  if (!vehicleId) throw new Error("Veículo inválido.");
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { modelId: modelId || null },
  });
  revalidatePath("/veiculos");
}

export async function createRate(formData: FormData) {
  const modelId = String(formData.get("modelId") ?? "");
  const rateReais = String(formData.get("rateReais") ?? "");
  const effectiveDate = String(formData.get("effectiveDate") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!modelId || !rateReais || !effectiveDate) {
    throw new Error("Preencha modelo, tarifa e data de vigência.");
  }

  await prisma.rate.create({
    data: {
      modelId,
      ratePerKmCentavos: parseReaisToCentavos(rateReais),
      effectiveDate: parseDateInput(effectiveDate),
      note: note || null,
    },
  });
  revalidatePath("/veiculos");
}
