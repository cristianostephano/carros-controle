"use client";

import { useState, useTransition } from "react";
import { createUploadTargets, importFromStorage } from "./actions";

export function ImportUploader({ periodId }: { periodId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (files.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        setStatus("Preparando o envio...");
        const targets = await createUploadTargets(periodId, files.length);

        const items: { path: string; fileName: string }[] = [];
        for (let i = 0; i < files.length; i++) {
          setStatus(`Enviando arquivo ${i + 1} de ${files.length}...`);
          const res = await fetch(targets[i].signedUrl, {
            method: "PUT",
            headers: {
              "x-upsert": "false",
              "cache-control": "max-age=3600",
              "content-type": files[i].type || "application/octet-stream",
            },
            body: files[i],
          });
          if (!res.ok) throw new Error(`Falha ao enviar "${files[i].name}" (código ${res.status}).`);
          items.push({ path: targets[i].path, fileName: files[i].name });
        }

        setStatus("Lendo a planilha e montando a prévia (pode levar alguns segundos)...");
        await importFromStorage(periodId, items);
      } catch (e) {
        // O redirect do Next sinaliza sucesso lançando um erro especial; deixa passar.
        if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
        if (typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
        setStatus(null);
        setError(e instanceof Error ? e.message : "Erro ao enviar a planilha.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-md border bg-white p-6">
      <label className="flex flex-col gap-1 text-sm">
        Arquivo(s) do relatório de percursos (.xlsx)
        <input
          type="file"
          accept=".xlsx"
          multiple
          disabled={pending}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="rounded-md border px-3 py-2 file:mr-3 file:rounded file:border-0 file:bg-brand-navy file:px-3 file:py-1 file:text-white"
        />
      </label>
      <p className="text-xs text-zinc-500">
        Se o rastreador só deixa baixar um arquivo por veículo/vendedor, você pode selecionar todos de uma vez aqui
        (segure Ctrl ou Shift na janela de escolha de arquivo). Nenhum arquivo original é alterado, e você vai poder
        conferir uma prévia combinada antes de confirmar a importação.
      </p>
      {status && <p className="text-sm text-zinc-600">{status}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending || files.length === 0}
        className="mt-2 rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-light disabled:opacity-50"
      >
        {pending ? "Enviando..." : "Enviar e conferir prévia"}
      </button>
    </div>
  );
}
