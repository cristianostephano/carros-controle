"use server";

import { prisma } from "@/lib/prisma";
import { runImport } from "@/lib/import/runImport";
import { redirect } from "next/navigation";

export async function importExcel(periodId: string, formData: FormData) {
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    throw new Error("Selecione ao menos um arquivo .xlsx para importar.");
  }

  const importIds: string[] = [];
  const failures: { fileName: string; error: string }[] = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { importId } = await runImport({ periodId, buffer, fileName: file.name });
      importIds.push(importId);
    } catch (e) {
      failures.push({ fileName: file.name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const params = new URLSearchParams();
  if (importIds.length > 0) params.set("ids", importIds.join(","));
  if (failures.length > 0) {
    params.set("falhas", failures.map((f) => `${f.fileName}: ${f.error}`).join("|"));
  }

  redirect(`/periodos/${periodId}/importacoes/lote?${params.toString()}`);
}

export async function confirmImport(importId: string) {
  const importRecord = await prisma.import.update({
    where: { id: importId },
    data: { status: "CONFIRMED" },
  });
  redirect(`/periodos/${importRecord.periodId}`);
}

export async function confirmImports(periodId: string, importIds: string[]) {
  await prisma.import.updateMany({
    where: { id: { in: importIds }, periodId },
    data: { status: "CONFIRMED" },
  });
  redirect(`/periodos/${periodId}`);
}

async function deleteImportInternal(importId: string) {
  const rawRows = await prisma.rawTripRow.findMany({ where: { importId }, select: { id: true } });
  const rawRowIds = rawRows.map((r) => r.id);
  await prisma.tripAuditLog.deleteMany({ where: { trip: { rawTripRowId: { in: rawRowIds } } } });
  await prisma.trip.deleteMany({ where: { rawTripRowId: { in: rawRowIds } } });
  await prisma.rawTripRow.deleteMany({ where: { importId } });
  await prisma.import.delete({ where: { id: importId } });
}

export async function deleteImport(importId: string) {
  const importRecord = await prisma.import.findUniqueOrThrow({ where: { id: importId } });
  await deleteImportInternal(importId);
  redirect(`/periodos/${importRecord.periodId}`);
}

export async function deleteImports(periodId: string, importIds: string[]) {
  for (const importId of importIds) {
    await deleteImportInternal(importId);
  }
  redirect(`/periodos/${periodId}/importar`);
}
