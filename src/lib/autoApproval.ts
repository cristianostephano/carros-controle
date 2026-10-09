/**
 * Com milhares de viagens por quinzena, revisar uma a uma não é viável. Pela regra atual, toda
 * viagem já nasce com resposta definida e confirmada: dia útil é PROFISSIONAL, fim de semana,
 * feriado e virada de meia-noite são PESSOAL. O vendedor pode trocar qualquer uma depois
 * (a resposta dele é a que vale), enquanto o período não estiver fechado.
 */
export const AUTO_APPROVAL_LABEL = "Sistema (aprovação automática)";

export function autoApprovalTripFields(classification: string, km: number | null) {
  if (classification === "PROFISSIONAL") {
    return {
      adminDecision: "PROFISSIONAL" as const,
      adminDecisionNote: null,
      adminDecidedAt: new Date(),
      adminDecidedBy: AUTO_APPROVAL_LABEL,
      status: "APROVADO_PELA_GESTAO" as const,
      reimbursableKm: 0,
    };
  }
  if (classification === "PESSOAL") {
    return {
      adminDecision: "PESSOAL" as const,
      adminDecisionNote: null,
      adminDecidedAt: new Date(),
      adminDecidedBy: AUTO_APPROVAL_LABEL,
      status: "APROVADO_PELA_GESTAO" as const,
      reimbursableKm: km ?? 0,
    };
  }
  return null;
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

export const VENDOR_PROFISSIONAL_APPROVAL_LABEL = "Sistema (vendedor declarou profissional)";

/** Declaração "profissional" do vendedor também vale como definitiva: entra aprovada, sem reembolso. */
export function vendorProfissionalApprovalFields() {
  return {
    adminDecision: "PROFISSIONAL" as const,
    adminDecisionNote: null,
    adminDecidedAt: new Date(),
    adminDecidedBy: VENDOR_PROFISSIONAL_APPROVAL_LABEL,
    status: "APROVADO_PELA_GESTAO" as const,
    reimbursableKm: 0,
  };
}
