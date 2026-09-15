import { prisma } from "@/lib/prisma";
import { importExcel } from "./actions";
import { notFound } from "next/navigation";

export default async function ImportarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const period = await prisma.period.findUnique({ where: { id } });
  if (!period) notFound();

  async function action(formData: FormData) {
    "use server";
    await importExcel(id, formData);
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold">Importar planilha</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Período: <span className="font-medium">{period.label}</span>
      </p>
      <form action={action} className="flex flex-col gap-4 rounded-md border bg-white p-6">
        <label className="flex flex-col gap-1 text-sm">
          Arquivo(s) do relatório de percursos (.xlsx)
          <input
            name="file"
            type="file"
            accept=".xlsx"
            required
            multiple
            className="rounded-md border px-3 py-2 file:mr-3 file:rounded file:border-0 file:bg-brand-navy file:px-3 file:py-1 file:text-white"
          />
        </label>
        <p className="text-xs text-zinc-500">
          Se o rastreador só deixa baixar um arquivo por veículo/vendedor, você pode selecionar todos de uma vez
          aqui (segure Ctrl ou Shift na janela de escolha de arquivo). Nenhum arquivo original é alterado, e você
          vai poder conferir uma prévia combinada antes de confirmar a importação.
        </p>
        <button
          type="submit"
          className="mt-2 rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-light"
        >
          Enviar e conferir prévia
        </button>
      </form>
    </div>
  );
}
