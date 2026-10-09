import "server-only";
import { createClient } from "@supabase/supabase-js";

export const IMPORT_BUCKET = "importacoes";

// O endereço do projeto Supabase vem do usuário do banco ("postgres.<ref>").
function supabaseUrl(): string {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL;
  const ref = new URL(process.env.DATABASE_URL ?? "").username.split(".")[1];
  if (!ref) throw new Error("Não consegui descobrir o endereço do Supabase. Configure SUPABASE_URL.");
  return `https://${ref}.supabase.co`;
}

export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(supabaseUrl(), key, { auth: { persistSession: false } });
}
