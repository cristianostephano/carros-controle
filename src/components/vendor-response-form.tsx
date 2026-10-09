"use client";

import { useState, useTransition } from "react";
import { formatDateBR, formatTimeBR } from "@/lib/dates";
import { submitResponses, type TripResponse } from "@/app/vendedor/[token]/actions";

export type ResponseTripRow = {
  id: string;
  startDateTime: Date;
  endDateTime: Date;
  originAddress: string | null;
  destAddress: string | null;
  km: number | null;
  autoClassification: string;
  autoClassificationReason: string;
  salespersonDeclaration: string | null;
  adminDecision: string | null;
  locked: boolean; // período fechado — valores já congelados, não dá mais pra mudar
};

const CLASSIFICATION_LABEL: Record<string, string> = {
  PROFISSIONAL: "Profissional",
  PESSOAL: "Pessoal",
  EM_ANALISE: "Em análise",
  NAO_CLASSIFICADO: "Não classificado",
};

export function VendorResponseForm({ token, rows }: { token: string; rows: ResponseTripRow[] }) {
  // Pré-preenche com a resposta real (do vendedor ou já decidida pela gestão). Sem resposta,
  // fim de semana, feriado e virada de meia-noite já vêm marcados como pessoal — o vendedor só
  // precisa trocar para profissional quando for o caso.
  const [answers, setAnswers] = useState<Record<string, "PESSOAL" | "PROFISSIONAL" | null>>(
    Object.fromEntries(
      rows.map((r) => [
        r.id,
        (r.salespersonDeclaration as "PESSOAL" | "PROFISSIONAL" | null) ??
          (r.adminDecision as "PESSOAL" | "PROFISSIONAL" | null) ??
          (r.autoClassification === "PESSOAL" || r.autoClassification === "EM_ANALISE" ? "PESSOAL" : null),
      ])
    )
  );
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problemIds, setProblemIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const editableRows = rows.filter((r) => !r.locked);
  const missing = editableRows.filter((r) => !answers[r.id]);

  const scrollToTrip = (id: string) => {
    // "instant" (não "smooth") porque a rolagem acontece junto com uma atualização de
    // estado do React — em alguns navegadores/ambientes, a rolagem suave é cancelada no
    // meio quando o DOM é atualizado ao mesmo tempo.
    document.getElementById(`trip-${id}`)?.scrollIntoView({ behavior: "instant", block: "center" });
  };

  const setDeclaration = (id: string, declaration: "PESSOAL" | "PROFISSIONAL") => {
    setAnswers((prev) => ({ ...prev, [id]: declaration }));
    setProblemIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (missing.length > 0) {
      const first = missing[0];
      scrollToTrip(first.id);
      setError(
        `Faltam ${missing.length} trajeto(s) sem resposta — o primeiro está destacado em vermelho abaixo (${formatDateBR(first.startDateTime)} às ${formatTimeBR(first.startDateTime)}).`
      );
      setProblemIds(new Set(missing.map((r) => r.id)));
      return;
    }
    setError(null);
    setProblemIds(new Set());
    const responses: TripResponse[] = editableRows.map((r) => ({
      tripId: r.id,
      declaration: answers[r.id]!,
    }));
    startTransition(async () => {
      try {
        await submitResponses(token, responses);
        setSubmitted(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível enviar. Tente de novo.");
      }
    });
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mb-4 text-4xl">✓</div>
        <h1 className="mb-2 text-lg font-semibold">Respostas enviadas!</h1>
        <p className="text-sm text-zinc-500">Obrigado. A gestão vai revisar suas respostas.</p>
        <button onClick={() => setSubmitted(false)} className="mt-6 text-sm text-zinc-600 underline">
          quero corrigir algo
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-4 flex flex-col gap-3">
        {rows.map((r) => {
          const answer = answers[r.id];
          const hasProblem = problemIds.has(r.id);
          // Fita colorida: verde = a gestão já tem uma decisão registrada pra esse
          // trajeto (nada pendente); amarelo = ainda não tem — ajuda o vendedor a ver
          // rápido o que ainda precisa de atenção, mesmo podendo mudar qualquer um.
          const ribbon = r.locked ? "border-l-zinc-300" : r.adminDecision ? "border-l-emerald-400" : "border-l-amber-400";
          return (
            <div
              key={r.id}
              id={`trip-${r.id}`}
              className={`rounded-lg border border-l-4 bg-white p-4 ${ribbon} ${
                hasProblem ? "border-2 border-red-500 ring-2 ring-red-200" : ""
              }`}
            >
              <div className="mb-2 text-sm text-zinc-500">
                {formatDateBR(r.startDateTime)} · {formatTimeBR(r.startDateTime)}-{formatTimeBR(r.endDateTime)} ·{" "}
                {r.km?.toFixed(2) ?? "-"} km
              </div>
              <div className="mb-1 text-sm">{r.originAddress ?? "-"}</div>
              <div className="mb-2 text-sm text-zinc-400">→ {r.destAddress ?? "-"}</div>
              <div className="mb-3 text-xs text-zinc-400">
                Sugestão automática: {CLASSIFICATION_LABEL[r.autoClassification]} ({r.autoClassificationReason})
              </div>

              {r.locked ? (
                <div className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
                  Período fechado: {CLASSIFICATION_LABEL[r.salespersonDeclaration ?? r.autoClassification]}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeclaration(r.id, "PESSOAL")}
                    className={`rounded-md border px-3 py-3 text-sm font-medium ${
                      answer === "PESSOAL"
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-amber-400 text-amber-700 hover:bg-amber-50"
                    }`}
                  >
                    {answer === "PESSOAL" ? "✓ Pessoal" : "Pessoal"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeclaration(r.id, "PROFISSIONAL")}
                    className={`rounded-md border px-3 py-3 text-sm font-medium ${
                      answer === "PROFISSIONAL"
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-emerald-400 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    {answer === "PROFISSIONAL" ? "✓ Profissional" : "Profissional"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full rounded-md bg-brand-navy px-4 py-3 text-base font-medium text-white hover:bg-brand-navy-light disabled:opacity-50"
      >
        {isPending ? "Enviando..." : "Enviar respostas"}
      </button>
    </div>
  );
}
