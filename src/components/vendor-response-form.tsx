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

type Answer = "PESSOAL" | "PROFISSIONAL" | null;
type Tab = "PESSOAL" | "MARGEM" | "PROFISSIONAL" | "TODAS";
type Group = "PESSOAL" | "MARGEM" | "PROFISSIONAL";

const CLASSIFICATION_LABEL: Record<string, string> = {
  PROFISSIONAL: "Profissional",
  PESSOAL: "Pessoal",
  EM_ANALISE: "Em análise",
  NAO_CLASSIFICADO: "Não classificado",
};

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// Expediente normal (08h às 18h). O horário de trabalho vai de 06h a 20h: as 2h antes e depois do
// expediente são a "margem de segurança", onde é comum o trajeto já ser fora do trabalho.
const EXPEDIENTE_START = 8 * 60;
const EXPEDIENTE_END = 18 * 60;

function minutesOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

// Só trajetos que o sistema marcou como profissionais e que tocam a margem (antes das 08h ou depois das 18h).
function marginLabel(r: ResponseTripRow): string | null {
  if (r.autoClassification !== "PROFISSIONAL") return null;
  const before = minutesOfDay(r.startDateTime) < EXPEDIENTE_START;
  const after = minutesOfDay(r.endDateTime) > EXPEDIENTE_END;
  if (before && after) return "Antes das 08h e depois das 18h";
  if (before) return "Antes do expediente (06h–08h)";
  if (after) return "Depois do expediente (18h–20h)";
  return null;
}

// Endereço curto (rua e número) para caber numa linha; o completo fica no "title".
function shortAddress(address: string | null): string {
  if (!address) return "-";
  return address.split(",").slice(0, 2).join(",").trim();
}

function formatKm(km: number): string {
  return km.toFixed(1).replace(".", ",");
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function VendorResponseForm({ token, rows }: { token: string; rows: ResponseTripRow[] }) {
  // Pré-preenche com a resposta real (do vendedor ou já decidida pela gestão). Sem resposta,
  // fim de semana, feriado e virada de meia-noite já vêm marcados como pessoal — o vendedor só
  // precisa trocar para profissional quando for o caso.
  const [answers, setAnswers] = useState<Record<string, Answer>>(
    Object.fromEntries(
      rows.map((r) => [
        r.id,
        (r.salespersonDeclaration as Answer) ??
          (r.adminDecision as Answer) ??
          (r.autoClassification === "PESSOAL" ? "PESSOAL" : null),
      ])
    )
  );
  // Em qual aba cada viagem fica é decidido uma vez só, na abertura da página, para a linha não
  // "sumir" da aba quando o vendedor troca a resposta dela.
  const [initialGroup] = useState<Record<string, Group>>(() =>
    Object.fromEntries(
      rows.map((r) => [r.id, answers[r.id] === "PESSOAL" ? "PESSOAL" : marginLabel(r) ? "MARGEM" : "PROFISSIONAL"])
    )
  );
  const [tab, setTab] = useState<Tab>(rows.some((r) => initialGroup[r.id] === "PESSOAL") ? "PESSOAL" : "TODAS");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problemIds, setProblemIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const editableRows = rows.filter((r) => !r.locked);
  const missing = editableRows.filter((r) => !answers[r.id]);

  const personalCount = rows.filter((r) => initialGroup[r.id] === "PESSOAL").length;
  const marginCount = rows.filter((r) => initialGroup[r.id] === "MARGEM").length;
  const professionalCount = rows.length - personalCount - marginCount;
  const kmPessoal = rows.reduce((acc, r) => acc + (answers[r.id] === "PESSOAL" ? (r.km ?? 0) : 0), 0);
  const kmProfissional = rows.reduce((acc, r) => acc + (answers[r.id] === "PROFISSIONAL" ? (r.km ?? 0) : 0), 0);

  const visibleRows = rows.filter((r) => tab === "TODAS" || initialGroup[r.id] === tab);
  const days: { key: string; date: Date; rows: ResponseTripRow[] }[] = [];
  for (const r of visibleRows) {
    const key = dayKey(r.startDateTime);
    const last = days[days.length - 1];
    if (last && last.key === key) last.rows.push(r);
    else days.push({ key, date: r.startDateTime, rows: [r] });
  }

  const scrollToTrip = (id: string) => {
    // "instant" (não "smooth") porque a rolagem acontece junto com uma atualização de
    // estado do React — em alguns navegadores/ambientes, a rolagem suave é cancelada no
    // meio quando o DOM é atualizado ao mesmo tempo.
    document.getElementById(`trip-${id}`)?.scrollIntoView({ behavior: "instant", block: "center" });
  };

  const clearProblem = (ids: string[]) =>
    setProblemIds((prev) => {
      if (!ids.some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });

  const setDeclaration = (id: string, declaration: "PESSOAL" | "PROFISSIONAL") => {
    setAnswers((prev) => ({ ...prev, [id]: declaration }));
    clearProblem([id]);
  };

  const setDayDeclaration = (dayRows: ResponseTripRow[], declaration: "PESSOAL" | "PROFISSIONAL") => {
    const ids = dayRows.filter((r) => !r.locked).map((r) => r.id);
    setAnswers((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, declaration])) }));
    clearProblem(ids);
  };

  const handleSubmit = () => {
    if (missing.length > 0) {
      const first = missing[0];
      setTab("TODAS");
      setTimeout(() => scrollToTrip(first.id), 50);
      setError(
        `Faltam ${missing.length} trajeto(s) sem resposta — o primeiro está destacado em vermelho (${formatDateBR(first.startDateTime)} às ${formatTimeBR(first.startDateTime)}).`
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "PESSOAL", label: `Pessoais (${personalCount})` },
    { id: "MARGEM", label: `Revisar horário (${marginCount})` },
    { id: "PROFISSIONAL", label: `Profissionais (${professionalCount})` },
    { id: "TODAS", label: `Todas (${rows.length})` },
  ];

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      <div className="mb-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <div className="text-lg font-semibold text-amber-800">{formatKm(kmPessoal)} km</div>
          <div className="text-xs text-amber-700">uso pessoal</div>
        </div>
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
          <div className="text-lg font-semibold text-emerald-800">{formatKm(kmProfissional)} km</div>
          <div className="text-xs text-emerald-700">uso profissional</div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 text-xs font-medium sm:grid-cols-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-2 py-2 ${
              tab === t.id ? "bg-white text-brand-navy shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "MARGEM" && (
        <p className="mb-3 text-xs text-zinc-500">
          Trajetos feitos entre 06h e 08h ou entre 18h e 20h. O sistema os marcou como profissionais por estarem
          na margem de segurança, mas confira: se algum não foi trabalho, troque para Pessoal.
        </p>
      )}

      {tab === "PROFISSIONAL" && (
        <p className="mb-3 text-xs text-zinc-500">
          Estes trajetos já vêm como profissionais. Se algum foi uso pessoal, troque para Pessoal.
        </p>
      )}

      {days.length === 0 && (
        <div className="mb-4 rounded-lg border border-dashed p-6 text-center text-sm text-zinc-500">
          Nenhum trajeto nesta aba.
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3">
        {days.map((day) => {
          const dayKm = day.rows.reduce((acc, r) => acc + (r.km ?? 0), 0);
          const hasEditable = day.rows.some((r) => !r.locked);
          return (
            <section key={day.key} className="overflow-hidden rounded-lg border bg-white">
              <header className="flex items-center justify-between gap-2 border-b bg-zinc-50 px-3 py-2">
                <div className="text-sm font-medium text-zinc-700">
                  {WEEKDAYS[day.date.getUTCDay()]}, {formatDateBR(day.date).slice(0, 5)}
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    {day.rows.length} {day.rows.length === 1 ? "viagem" : "viagens"} · {formatKm(dayKm)} km
                  </span>
                </div>
                {hasEditable && day.rows.length > 1 && (
                  <div className="flex shrink-0 gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setDayDeclaration(day.rows, "PESSOAL")}
                      className="text-amber-700 underline"
                    >
                      tudo pessoal
                    </button>
                    <button
                      type="button"
                      onClick={() => setDayDeclaration(day.rows, "PROFISSIONAL")}
                      className="text-emerald-700 underline"
                    >
                      tudo profissional
                    </button>
                  </div>
                )}
              </header>

              <div className="divide-y">
                {day.rows.map((r) => {
                  const answer = answers[r.id];
                  const hasProblem = problemIds.has(r.id);
                  return (
                    <div
                      key={r.id}
                      id={`trip-${r.id}`}
                      className={`flex items-center gap-2 px-3 py-2 ${
                        hasProblem ? "bg-red-50 ring-2 ring-inset ring-red-400" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-zinc-500">
                          {formatTimeBR(r.startDateTime).slice(0, 5)}–{formatTimeBR(r.endDateTime).slice(0, 5)} ·{" "}
                          {r.km != null ? formatKm(r.km) : "-"} km
                        </div>
                        <div className="truncate text-sm" title={r.originAddress ?? "-"}>
                          {shortAddress(r.originAddress)}
                        </div>
                        <div className="truncate text-sm text-zinc-500" title={r.destAddress ?? "-"}>
                          → {shortAddress(r.destAddress)}
                        </div>
                        {initialGroup[r.id] === "MARGEM" ? (
                          <div className="truncate text-[11px] font-medium text-amber-700" title={marginLabel(r) ?? ""}>
                            {marginLabel(r)}
                          </div>
                        ) : (
                          <div className="truncate text-[11px] text-zinc-400" title={r.autoClassificationReason}>
                            {r.autoClassificationReason}
                          </div>
                        )}
                      </div>

                      {r.locked ? (
                        <div className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                          Fechado: {CLASSIFICATION_LABEL[r.salespersonDeclaration ?? r.autoClassification]}
                        </div>
                      ) : (
                        <div className="flex shrink-0 overflow-hidden rounded-md border border-zinc-300 text-xs font-medium">
                          <button
                            type="button"
                            onClick={() => setDeclaration(r.id, "PESSOAL")}
                            className={`px-2.5 py-2 ${
                              answer === "PESSOAL" ? "bg-amber-500 text-white" : "bg-white text-amber-700 hover:bg-amber-50"
                            }`}
                          >
                            Pessoal
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeclaration(r.id, "PROFISSIONAL")}
                            className={`border-l border-zinc-300 px-2.5 py-2 ${
                              answer === "PROFISSIONAL"
                                ? "bg-emerald-500 text-white"
                                : "bg-white text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            Profissional
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
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
