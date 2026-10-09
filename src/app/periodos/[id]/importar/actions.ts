"use server";

import { prisma } from "@/lib/prisma";
import { runImport } from "@/lib/import/runImport";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { IMPORT_BUCKET, supabaseAdmin } from "@/lib/supabaseAdmin";

/** Passo 1: gera um endereço de envio direto ao Supabase para cada arquivo (evita o limite de 4,5 MB do Vercel). */
export async function createUploadTargets(periodId: string, count: number) {
  await prisma.period.findUniqueOrThrow({ where: { id: periodId } });
  if (!Number.isInteger(count) || count < 1 || count > 30) throw new Error("Quantidade de arquivos inválida.");

  const storage = supabaseAdmin().storage.from(IMPORT_BUCKET);
  const targets: { path: string; signedUrl: string }[] = [];
  for (let n = 0; n < count; n++) {
    const path = `${periodId}/${randomUUID()}.xlsx`;
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) throw new Error(`Não foi possível preparar o envio: ${error?.message ?? "erro desconhecido"}`);
    targets.push({ path, signedUrl: data.signedUrl });
  }
  return targets;
}

/** Passo 2: lê os arquivos já enviados, importa e apaga os arquivos do Supabase em seguida. */
export async function importFromStorage(periodId: string, items: { path: string; fileName: string }[]) {
  const storage = supabaseAdmin().storage.from(IMPORT_BUCKET);
  const importIds: string[] = [];
  const failures: { fileName: string; error: string }[] = [];

  for (const item of items) {
    try {
      if (!item.path.startsWith(`${periodId}/`) || item.path.includes("..")) throw new Error("Caminho inválido.");
      const { data, error } = await storage.download(item.path);
      if (error || !data) throw new Error(error?.message ?? "Arquivo não encontrado no armazenamento.");
      const buffer = Buffer.from(await data.arrayBuffer());
      const { importId } = await runImport({ periodId, buffer, fileName: item.fileName });
      importIds.push(importId);
    } catch (e) {
      failures.push({ fileName: item.fileName, error: e instanceof Error ? e.message : String(e) });
    } finally {
      await storage.remove([item.path]).catch(() => {});
    }
  }

  const params = new URLSearchParams();
  if (importIds.length > 0) params.set("ids", importIds.join(","));
  if (failures.length > 0) params.set("falhas", failures.map((f) => `${f.fileName}: ${f.error}`).join("|"));
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
