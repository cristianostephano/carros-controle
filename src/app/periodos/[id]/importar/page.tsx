import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ImportUploader } from "./import-uploader";

// A leitura e gravação de uma planilha grande pode passar do tempo padrão do Vercel.
export const maxDuration = 60;

export default async function ImportarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const period = await prisma.period.findUnique({ where: { id } });
  if (!period) notFound();

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold">Importar planilha</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Período: <span className="font-medium">{period.label}</span>
      </p>
      <ImportUploader periodId={id} />
    </div>
  );
}
