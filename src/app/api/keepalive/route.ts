import { prisma } from "@/lib/prisma";

// Chamado todo dia pelo agendador do Vercel (vercel.json) só para o Supabase gratuito
// enxergar atividade e não pausar o projeto por inatividade.
export async function GET() {
  await prisma.$queryRaw`select 1`;
  return Response.json({ ok: true });
}
