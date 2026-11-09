import { createPeriod, generateMonthPeriods, generateMonthlyPeriod } from "@/app/periodos/actions";

export default function NovoPeriodoPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold">Novo período</h1>

      <div className="mb-8 rounded-md border bg-white p-6">
        <h2 className="mb-1 text-base font-semibold">Gerar o ciclo mensal do RH (21 a 20)</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Escolha o mês de fechamento. Ex.: &ldquo;novembro&rdquo; cria o período de 21/10 a 20/11. Os vendedores
          têm até o dia 22 para ajustar, e o fechamento é no dia 23 (entrega ao RH no próximo dia útil se cair em
          fim de semana ou feriado).
        </p>
        <form action={generateMonthlyPeriod} className="flex items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Mês de fechamento
            <input name="month" type="month" required className="rounded-md border px-3 py-2" />
          </label>
          <button
            type="submit"
            className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-light"
          >
            Gerar ciclo mensal
          </button>
        </form>
      </div>

      <div className="mb-8 rounded-md border bg-white p-6">
        <h2 className="mb-1 text-base font-semibold">Gerar as duas quinzenas do mês</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Cria automaticamente do dia 01 ao 15, e do dia 16 até o último dia útil do mês (pula fins de
          semana e feriados nacionais).
        </p>
        <form action={generateMonthPeriods} className="flex items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Mês
            <input name="month" type="month" required className="rounded-md border px-3 py-2" />
          </label>
          <button
            type="submit"
            className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-light"
          >
            Gerar quinzenas
          </button>
        </form>
      </div>

      <div className="rounded-md border bg-white p-6">
        <h2 className="mb-4 text-base font-semibold">Ou criar um período manualmente</h2>
        <form action={createPeriod} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Nome do período
            <input
              name="label"
              required
              placeholder="Ex: 19/06 a 25/06/2026"
              className="rounded-md border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Data inicial
            <input name="startDate" type="date" required className="rounded-md border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Data final
            <input name="endDate" type="date" required className="rounded-md border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Prazo para os vendedores responderem (opcional)
            <input name="responseDeadline" type="date" className="rounded-md border px-3 py-2" />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Criar período
          </button>
        </form>
      </div>
    </div>
  );
}
