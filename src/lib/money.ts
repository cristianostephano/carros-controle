import Decimal from "decimal.js";

/** Converte um valor em reais digitado pelo usuário (aceita "1,25" ou "1.25") para centavos inteiros. */
export function parseReaisToCentavos(input: string): number {
  let normalized = input.trim();
  // só trata "." como separador de milhar se também houver vírgula decimal (ex: "1.234,56");
  // "0.45" (ponto já como decimal) precisa ficar intacto.
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }
  const value = new Decimal(normalized || "0");
  return value.times(100).round().toNumber();
}

export function formatCentavosAsReais(centavos: number): string {
  return new Decimal(centavos).dividedBy(100).toFixed(2).replace(".", ",");
}
