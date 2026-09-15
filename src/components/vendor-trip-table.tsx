"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { formatDateTimeBR, formatDateBR, formatDurationHMS, formatTimeBR } from "@/lib/dates";
import { formatCentavosAsReais } from "@/lib/money";
import { approveTrip, adjustTrip, bulkApprove, bulkSetDecision } from "@/app/periodos/[id]/actions";

export type VendorTripRow = {
  id: string;
  salespersonName?: string;
  vehiclePlate?: string;
  startDateTime: Date;
  endDateTime: Date;
  originAddress: string | null;
  destAddress: string | null;
  km: number | null;
  durationSeconds: number | null;
  autoClassification: string;
  autoClassificationReason: string;
  salespersonDeclaration: string | null;
  salespersonJustification: string | null;
  adminDecision: string | null;
  adminDecisionNote: string | null;
  status: string;
  reimbursableKm: number | null;
  rateCentavos: number | null;
  auditLogs: {
    id: string;
    action: string;
    actorType: string;
    actorLabel: string | null;
    note: string | null;
    createdAt: Date;
  }[];
};

const ACTION_LABEL: Record<string, string> = {
  AUTO_CLASSIFIED: "Classificação automática",
  AUTO_APPROVED: "Aprovação automática",
  AGUARDANDO_REVISAO: "Voltou para revisão da gestão",
  SALESPERSON_DECLARED: "Declaração do vendedor",
  ADMIN_APPROVED: "Aprovado pela gestão",
  ADMIN_ADJUSTED: "Ajustado pela gestão",
  ADMIN_BULK_ACTION: "Ação em lote pela gestão",
  PERIOD_CLOSED: "Período fechado",
  PERIOD_REOPENED: "Período reaberto",
};

const ACTOR_LABEL: Record<string, string> = {
  SYSTEM: "Sistema",
  SALESPERSON: "Vendedor",
  ADMIN: "Gestão",
};

const CLASSIFICATION_LABEL: Record<string, string> = {
  PROFISSIONAL: "Profissional",
  PESSOAL: "Pessoal",
  EM_ANALISE: "Em análise",
  NAO_CLASSIFICADO: "Não classificado",
};

const STATUS_LABEL: Record<string, string> = {
  AGUARDANDO_DEVOLUTIVA: "Aguardando devolutiva",
  RESPONDIDO_PELO_VENDEDOR: "Respondido pelo vendedor",
  APROVADO_PELA_GESTAO: "Aprovado",
  AJUSTADO_PELA_GESTAO: "Ajustado",
  FECHADO: "Fechado",
};

export function VendorTripTable({
  periodId,
  rows,
  showVendorColumn = false,
}: {
  periodId: string;
  rows: VendorTripRow[];
  showVendorColumn?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Ao abrir a tela, já rola direto pra primeira viagem que ainda precisa de decisão
    // da gestão, em vez de deixar quem entrou tendo que procurar na lista inteira.
    const firstPending = rows.find((r) => !r.adminDecision);
    if (firstPending) {
      document.getElementById(`trip-row-${firstPending.id}`)?.scrollIntoView({ behavior: "instant", block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  };

  const runBulk = (fn: () => Promise<void>) => {
    startTransition(async () => {
      await fn();
      setSelected(new Set());
    });
  };

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm">
          <span className="font-medium">{selected.size} selecionada(s)</span>
          <button
            disabled={isPending}
            onClick={() => runBulk(() => bulkApprove(periodId, [...selected]))}
            className="rounded-md bg-brand-navy px-3 py-1 text-white hover:bg-brand-navy-light disabled:opacity-50"
          >
            Aprovar sugestão automática
          </button>
          <button
            disabled={isPending}
            onClick={() => runBulk(() => bulkSetDecision(periodId, [...selected], "PESSOAL"))}
            className="rounded-md border border-amber-400 px-3 py-1 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            Marcar como Pessoal
          </button>
          <button
            disabled={isPending}
            onClick={() => runBulk(() => bulkSetDecision(periodId, [...selected], "PROFISSIONAL"))}
            className="rounded-md border border-emerald-400 px-3 py-1 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            Marcar como Profissional
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-md border bg-white p-6 text-center text-sm text-zinc-500">
          Nenhuma viagem encontrada para este vendedor neste período.
        </div>
      ) : (
      <div className="overflow-x-auto rounded-md border bg-white">
        <table className="w-full min-w-[1400px] text-left text-sm">
          <thead className="border-b bg-zinc-50">
            <tr>
              <th className="sticky left-0 z-20 bg-zinc-50 px-2 py-2">
                <input
                  type="checkbox"
                  checked={selected.size === rows.length && rows.length > 0}
                  onChange={toggleAll}
                />
              </th>
              {showVendorColumn && <th className="px-2 py-2 font-medium text-zinc-600">Vendedor</th>}
              <th className="px-2 py-2 font-medium text-zinc-600">Data / Horário</th>
              <th className="px-2 py-2 font-medium text-zinc-600">Origem → Destino</th>
              <th className="px-2 py-2 font-medium text-zinc-600">Km / Duração</th>
              <th className="px-2 py-2 font-medium text-zinc-600">Auto</th>
              <th className="px-2 py-2 font-medium text-zinc-600">Resposta do vendedor</th>
              <th className="px-2 py-2 font-medium text-zinc-600">Decisão gestão</th>
              <th className="px-2 py-2 font-medium text-zinc-600">Km reembolsável / Valor</th>
              <th className="px-2 py-2 font-medium text-zinc-600">Status</th>
              <th className="sticky right-0 z-20 border-l bg-zinc-50 px-2 py-2 font-medium text-zinc-600">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const needsReview = !r.adminDecision;
              // As colunas fixas (sticky) precisam de fundo 100% opaco — um fundo com
              // transparência (ex: bg-amber-50/40) deixa o conteúdo das outras colunas
              // "vazar" visualmente por baixo delas quando a tabela é rolada na horizontal,
              // já que a coluna fixa fica sobreposta ao conteúdo que passa por trás dela.
              const stickyBg = needsReview ? "bg-amber-50" : "bg-white";
              return (
              <Fragment key={r.id}>
              <tr
                id={`trip-row-${r.id}`}
                className={`border-b align-top last:border-0 hover:bg-zinc-100 ${
                  needsReview ? "border-l-4 border-l-amber-400 bg-amber-50/40" : "bg-white"
                }`}
              >
                <td className={`sticky left-0 z-10 px-2 py-2 ${stickyBg}`}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                </td>
                {showVendorColumn && (
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div>{r.salespersonName ?? "-"}</div>
                    {r.vehiclePlate && <div className="text-xs text-zinc-400">{r.vehiclePlate}</div>}
                  </td>
                )}
                <td className="px-2 py-2 whitespace-nowrap">
                  {formatDateBR(r.startDateTime)}
                  <br />
                  {formatTimeBR(r.startDateTime)}-{formatTimeBR(r.endDateTime)}
                </td>
                <td className="px-2 py-2 max-w-xs">
                  <div className="truncate" title={r.originAddress ?? ""}>{r.originAddress ?? "-"}</div>
                  <div className="truncate text-zinc-400" title={r.destAddress ?? ""}>→ {r.destAddress ?? "-"}</div>
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {r.km != null ? r.km.toFixed(2) : "-"} km
                  <br />
                  {formatDurationHMS(r.durationSeconds)}
                </td>
                <td className="px-2 py-2">
                  <div>{CLASSIFICATION_LABEL[r.autoClassification] ?? r.autoClassification}</div>
                  <div className="text-xs text-zinc-400">{r.autoClassificationReason}</div>
                </td>
                <td className="px-2 py-2">
                  {r.salespersonDeclaration ? CLASSIFICATION_LABEL[r.salespersonDeclaration] : "-"}
                  {r.salespersonJustification && (
                    <div className="text-xs text-zinc-400">{r.salespersonJustification}</div>
                  )}
                </td>
                <td className="px-2 py-2">
                  {r.adminDecision ? (
                    <>
                      <span className="font-medium">{CLASSIFICATION_LABEL[r.adminDecision]}</span>
                      {r.adminDecisionNote && (
                        <div className="text-xs text-zinc-400">{r.adminDecisionNote}</div>
                      )}
                    </>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Pendente
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {r.reimbursableKm != null ? `${r.reimbursableKm.toFixed(2)} km` : "-"}
                  <br />
                  {r.reimbursableKm && r.rateCentavos
                    ? `R$ ${formatCentavosAsReais(Math.round(r.reimbursableKm * r.rateCentavos))}`
                    : "-"}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-xs">{STATUS_LABEL[r.status] ?? r.status}</td>
                <td className={`sticky right-0 z-10 border-l px-2 py-2 ${stickyBg}`}>
                  <div className="flex w-40 flex-col gap-1">
                    {!r.adminDecision &&
                      (r.salespersonDeclaration ?? r.autoClassification) !== "EM_ANALISE" &&
                      (r.salespersonDeclaration ?? r.autoClassification) !== "NAO_CLASSIFICADO" && (
                        <button
                          disabled={isPending}
                          onClick={() => startTransition(() => approveTrip(r.id))}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
                        >
                          Aprovar sugestão
                        </button>
                      )}
                    <input
                      placeholder="Justificativa (opcional)"
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      className="rounded border px-2 py-1 text-xs"
                    />
                    <div className="flex gap-1">
                      <button
                        disabled={isPending || r.adminDecision === "PESSOAL"}
                        onClick={() =>
                          startTransition(() => adjustTrip(r.id, "PESSOAL", notes[r.id] ?? ""))
                        }
                        className={`flex-1 rounded border px-2 py-1 text-xs ${
                          r.adminDecision === "PESSOAL"
                            ? "border-amber-500 bg-amber-500 font-medium text-white"
                            : "border-amber-400 text-amber-700 hover:bg-amber-50"
                        } ${isPending ? "opacity-50" : ""}`}
                      >
                        {r.adminDecision === "PESSOAL" ? "✓ Pessoal" : "Pessoal"}
                      </button>
                      <button
                        disabled={isPending || r.adminDecision === "PROFISSIONAL"}
                        onClick={() =>
                          startTransition(() => adjustTrip(r.id, "PROFISSIONAL", notes[r.id] ?? ""))
                        }
                        className={`flex-1 rounded border px-2 py-1 text-xs ${
                          r.adminDecision === "PROFISSIONAL"
                            ? "border-emerald-500 bg-emerald-500 font-medium text-white"
                            : "border-emerald-400 text-emerald-700 hover:bg-emerald-50"
                        } ${isPending ? "opacity-50" : ""}`}
                      >
                        {r.adminDecision === "PROFISSIONAL" ? "✓ Profissional" : "Profissional"}
                      </button>
                    </div>
                    <button
                      onClick={() => toggleExpanded(r.id)}
                      className="mt-1 text-left text-xs text-zinc-400 underline"
                    >
                      {expanded.has(r.id) ? "ocultar histórico" : `histórico (${r.auditLogs.length})`}
                    </button>
                  </div>
                </td>
              </tr>
              {expanded.has(r.id) && (
                <tr className="border-b bg-zinc-50 last:border-0">
                  <td></td>
                  <td colSpan={showVendorColumn ? 10 : 9} className="px-2 py-2">
                    <ul className="space-y-1 text-xs text-zinc-600">
                      {r.auditLogs.map((log) => (
                        <li key={log.id}>
                          <span className="font-medium">{formatDateTimeBR(log.createdAt)}</span> —{" "}
                          {ACTION_LABEL[log.action] ?? log.action} ({ACTOR_LABEL[log.actorType] ?? log.actorType}
                          {log.actorLabel ? `: ${log.actorLabel}` : ""})
                          {log.note && <span className="text-zinc-400"> — {log.note}</span>}
                        </li>
                      ))}
                      {r.auditLogs.length === 0 && <li>Nenhum registro.</li>}
                    </ul>
                  </td>
                </tr>
              )}
              </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
