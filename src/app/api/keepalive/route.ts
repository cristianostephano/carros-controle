import { prisma } from "@/lib/prisma";
import { IMPORT_BUCKET, supabaseAdmin } from "@/lib/supabaseAdmin";

// Chamado todo dia pelo agendador do Vercel (vercel.json). O Supabase gratuito pausa o
// projeto sem atividade na API dele, então além de consultar o banco fazemos uma chamada
// real à API de armazenamento (sem ler nem alterar nenhum dado).
export async function GET() {
  await prisma.$queryRaw`select 1`;
  const { error } = await supabaseAdmin().storage.from(IMPORT_BUCKET).list("", { limit: 1 });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
