"use client";

import { useState } from "react";
import { formatDateBR } from "@/lib/dates";
import { regenerateLink, setLinkLocked } from "@/app/periodos/[id]/vendedores/[salespersonId]/actions";

export function VendorLinkCard({
  periodId,
  salespersonId,
  salespersonName,
  periodStart,
  periodEnd,
  token,
  baseUrl,
  expiresAt,
  locked,
  submittedAt,
}: {
  periodId: string;
  salespersonId: string;
  salespersonName: string;
  periodStart: Date;
  periodEnd: Date;
  token: string;
  baseUrl: string;
  expiresAt: Date | null;
  locked: boolean;
  submittedAt: Date | null;
}) {
  const [copied, setCopied] = useState<"link" | "mensagem" | null>(null);
  const link = `${baseUrl}/vendedor/${token}`;
  const prazo = expiresAt ? formatDateBR(expiresAt) : "sem prazo definido";
  const message = `Olá, ${salespersonName}. A conferência dos trajetos do período ${formatDateBR(
    periodStart
  )} a ${formatDateBR(periodEnd)} está disponível. Por favor, informe para cada trajeto se o uso foi pessoal ou profissional até ${prazo}. Acesse: ${link}`;

  const copy = async (text: string, which: "link" | "mensagem") => {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="mb-6 rounded-md border bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-600">Link individual do vendedor</h2>

      {locked ? (
        <div className="mb-3 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
          Link bloqueado — o vendedor não consegue mais responder.
        </div>
      ) : (
        <div className="mb-3 flex items-center gap-2">
          <input readOnly value={link} className="flex-1 rounded-md border bg-zinc-50 px-3 py-2 text-sm" />
          <button
            onClick={() => copy(link, "link")}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
          >
            {copied === "link" ? "Copiado!" : "Copiar link"}
          </button>
        </div>
      )}

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500">Mensagem para WhatsApp</span>
          <button onClick={() => copy(message, "mensagem")} className="text-xs text-zinc-600 underline">
            {copied === "mensagem" ? "Copiado!" : "Copiar mensagem"}
          </button>
        </div>
        <p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">{message}</p>
      </div>

      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span>Prazo: {prazo}</span>
        <span>{submittedAt ? `Respondido em ${formatDateBR(submittedAt)}` : "Ainda não respondido"}</span>
        <form action={() => regenerateLink(periodId, salespersonId)}>
          <button type="submit" className="text-red-600 underline">
            gerar novo link (invalida o atual)
          </button>
        </form>
        <form action={() => setLinkLocked(periodId, salespersonId, !locked)}>
          <button type="submit" className="underline">
            {locked ? "desbloquear" : "bloquear"}
          </button>
        </form>
      </div>
    </div>
  );
}
