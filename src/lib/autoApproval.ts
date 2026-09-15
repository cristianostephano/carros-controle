/**
 * Com milhares de viagens por quinzena, revisar manualmente cada uma que já é
 * claramente profissional (dentro do expediente) não é viável. Por isso, toda viagem
 * classificada automaticamente como PROFISSIONAL já entra aprovada, deixando a fila de
 * revisão só com o que realmente precisa de decisão (pessoal ou em análise). A gestão
 * sempre pode ajustar manualmente depois, se algum caso for exceção.
 */
export const AUTO_APPROVAL_LABEL = "Sistema (aprovação automática)";

export function autoApprovalTripFields(classification: string) {
  if (classification !== "PROFISSIONAL") return null;
  return {
    adminDecision: "PROFISSIONAL" as const,
    adminDecisionNote: null,
    adminDecidedAt: new Date(),
    adminDecidedBy: AUTO_APPROVAL_LABEL,
    status: "APROVADO_PELA_GESTAO" as const,
    reimbursableKm: 0,
  };
}

/**
 * Da mesma forma, quando o próprio vendedor declara que uma viagem foi uso pessoal,
 * a gestão não precisa revisar esse caso — só faz sentido revisar quando o vendedor
 * afirma que foi profissional (contrariando a sugestão do sistema), que é o cenário que
 * realmente merece conferência. A declaração de "pessoal" já entra aprovada, ficando
 * disponível só para consulta da gestão.
 */
export const VENDOR_PESSOAL_AUTO_APPROVAL_LABEL = "Sistema (vendedor declarou pessoal)";

export function vendorPessoalAutoApprovalFields(km: number | null) {
  return {
    adminDecision: "PESSOAL" as const,
    adminDecisionNote: null,
    adminDecidedAt: new Date(),
    adminDecidedBy: VENDOR_PESSOAL_AUTO_APPROVAL_LABEL,
    status: "APROVADO_PELA_GESTAO" as const,
    reimbursableKm: km,
  };
}

/**
 * Único caso que realmente exige revisão da gestão: o vendedor declara "profissional"
 * para um trajeto fora do expediente (ou em análise). Isso vale mesmo que o trajeto já
 * tivesse uma decisão anterior (automática ou manual) — a resposta mais recente do
 * vendedor é sempre a informação mais atual, então qualquer decisão antiga é desfeita e
 * o trajeto volta pra fila de revisão.
 */
export function pendingGestaoReviewFields() {
  return {
    adminDecision: null,
    adminDecisionNote: null,
    adminDecidedAt: null,
    adminDecidedBy: null,
    status: "RESPONDIDO_PELO_VENDEDOR" as const,
    reimbursableKm: null,
  };
}
