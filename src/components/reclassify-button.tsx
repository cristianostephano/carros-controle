"use client";

import { useState, useTransition } from "react";
import { reclassifyPeriod } from "@/app/periodos/[id]/actions";

export function ReclassifyButton({ periodId }: { periodId: string }) {
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const { checked, updated } = await reclassifyPeriod(periodId);
        setMessage({
          text:
            updated > 0
              ? `Pronto: ${updated} de ${checked} viagens foram atualizadas.`
              : `Pronto: as ${checked} viagens já estavam corretas, nada precisou mudar.`,
          error: false,
        });
      } catch {
        setMessage({
          text: "Não foi possível reclassificar. Atualize a página (Ctrl + F5) e tente de novo.",
          error: true,
        });
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? "Reclassificando..." : "Reclassificar viagens"}
      </button>
      {pending && <span className="text-xs text-zinc-500">Pode levar até 1 minuto, não feche a página.</span>}
      {message && <span className={`text-xs ${message.error ? "text-red-600" : "text-emerald-700"}`}>{message.text}</span>}
    </div>
  );
}
