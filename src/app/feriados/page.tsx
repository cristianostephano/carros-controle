import { prisma } from "@/lib/prisma";
import { ensureNationalHolidaysSeeded } from "@/lib/holidaySeed";
import { formatDateBR, formatWeekdayBR } from "@/lib/dates";
import { createHolidayException, deleteHoliday } from "./actions";

const SCOPE_LABEL: Record<string, string> = {
  NACIONAL: "Nacional",
  MUNICIPAL: "Municipal",
  EXCECAO_MANUAL: "Exceção manual",
};

const TYPE_LABEL: Record<string, string> = {
  FOLGA: "Sem expediente",
  DIA_UTIL_ESPECIAL: "Dia útil especial",
};

export default async function FeriadosPage() {
  const currentYear = new Date().getUTCFullYear();
  await ensureNationalHolidaysSeeded(currentYear);
  await ensureNationalHolidaysSeeded(currentYear + 1);

  const holidays = await prisma.holiday.findMany({ orderBy: { date: "asc" } });

  async function deleteAction(formData: FormData) {
    "use server";
    await deleteHoliday(String(formData.get("id")));
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold">Calendário de feriados</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Feriados nacionais já vêm carregados automaticamente. Cadastre aqui feriados municipais ou
        exceções (ex: um sábado que virou dia útil, ou uma liberação pontual).
      </p>

      <div className="mb-8 rounded-md border bg-white p-6">
        <h2 className="mb-4 text-base font-semibold">Adicionar exceção</h2>
        <form action={createHolidayException} className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Data
            <input name="date" type="date" required className="rounded-md border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Nome
            <input
              name="name"
              required
              placeholder="Ex: Aniversário da cidade"
              className="rounded-md border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Abrangência
            <select name="scope" defaultValue="MUNICIPAL" className="rounded-md border px-3 py-2">
              <option value="MUNICIPAL">Municipal</option>
              <option value="EXCECAO_MANUAL">Exceção manual</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Tipo
            <select name="type" defaultValue="FOLGA" className="rounded-md border px-3 py-2">
              <option value="FOLGA">Sem expediente (feriado)</option>
              <option value="DIA_UTIL_ESPECIAL">Dia útil especial (trabalha normalmente)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Início do expediente nesse dia (só se for dia útil especial)
            <input name="customWindowStart" type="time" className="rounded-md border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Fim do expediente nesse dia (só se for dia útil especial)
            <input name="customWindowEnd" type="time" className="rounded-md border px-3 py-2" />
          </label>
          <button
            type="submit"
            className="col-span-2 mt-2 rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-light"
          >
            Adicionar
          </button>
        </form>
      </div>

      <div className="rounded-md border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-zinc-50">
            <tr>
              <th className="px-3 py-2 font-medium text-zinc-600">Data</th>
              <th className="px-3 py-2 font-medium text-zinc-600">Nome</th>
              <th className="px-3 py-2 font-medium text-zinc-600">Abrangência</th>
              <th className="px-3 py-2 font-medium text-zinc-600">Tipo</th>
              <th className="px-3 py-2 font-medium text-zinc-600"></th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((h) => (
              <tr key={h.id} className="border-b last:border-0">
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatDateBR(h.date)} ({formatWeekdayBR(h.date)})
                </td>
                <td className="px-3 py-2">{h.name}</td>
                <td className="px-3 py-2">{SCOPE_LABEL[h.scope] ?? h.scope}</td>
                <td className="px-3 py-2">
                  {TYPE_LABEL[h.type] ?? h.type}
                  {h.type === "DIA_UTIL_ESPECIAL" && h.customWindowStart && h.customWindowEnd
                    ? ` (${h.customWindowStart}-${h.customWindowEnd})`
                    : ""}
                </td>
                <td className="px-3 py-2 text-right">
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={h.id} />
                    <button type="submit" className="text-red-600 hover:underline">
                      excluir
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
