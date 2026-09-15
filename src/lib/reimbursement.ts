import { prisma } from "@/lib/prisma";

/** Tarifa vigente (R$/km em centavos) de um veículo, pela data de referência (padrão: agora). */
export async function getCurrentRateCentavosForVehicle(
  vehicleId: string,
  at: Date = new Date()
): Promise<number | null> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { modelId: true },
  });
  if (!vehicle?.modelId) return null;

  const rate = await prisma.rate.findFirst({
    where: { modelId: vehicle.modelId, effectiveDate: { lte: at } },
    orderBy: { effectiveDate: "desc" },
  });
  return rate?.ratePerKmCentavos ?? null;
}
