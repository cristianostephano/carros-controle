import { prisma } from "@/lib/prisma";
import { ensureDefaultVehicleModelsSeeded } from "@/lib/vehicleModelSeed";
import { formatDateBR } from "@/lib/dates";
import { formatCentavosAsReais } from "@/lib/money";
import { createVehicleModel, assignVehicleModel, createRate } from "./actions";

export default async function VeiculosPage() {
  await ensureDefaultVehicleModelsSeeded();

  const [models, vehicles] = await Promise.all([
    prisma.vehicleModel.findMany({
      include: { rates: { orderBy: { effectiveDate: "desc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.vehicle.findMany({ include: { model: true }, orderBy: { plate: "asc" } }),
  ]);

  const now = new Date();

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold">Veículos e tarifas</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Cada veículo tem um modelo; cada modelo tem uma tarifa de reembolso em R$/km que pode mudar ao
        longo do tempo. O período fechado sempre usa a tarifa que estava vigente na hora do fechamento.
      </p>

      <div className="mb-8 rounded-md border bg-white p-6">
        <h2 className="mb-4 text-base font-semibold">Modelos e tarifas</h2>

        <form action={createVehicleModel} className="mb-6 flex items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Novo modelo
            <input name="name" placeholder="Ex: Chevrolet Onix" className="rounded-md border px-3 py-2" />
          </label>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Adicionar modelo
          </button>
        </form>

        <div className="flex flex-col gap-6">
          {models.map((model) => {
            const currentRate = model.rates.find((r) => r.effectiveDate <= now);
            return (
              <div key={model.id} className="rounded-md border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium">{model.name}</h3>
                  <span className="text-sm text-zinc-500">
                    Tarifa vigente:{" "}
                    <span className="font-semibold text-zinc-900">
                      {currentRate ? `R$ ${formatCentavosAsReais(currentRate.ratePerKmCentavos)}/km` : "não definida"}
                    </span>
                  </span>
                </div>

                {model.rates.length > 0 && (
                  <table className="mb-3 w-full text-left text-sm">
                    <thead>
                      <tr className="text-zinc-500">
                        <th className="pb-1 font-medium">Vigência desde</th>
                        <th className="pb-1 font-medium">Tarifa</th>
                        <th className="pb-1 font-medium">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.rates.map((rate) => (
                        <tr key={rate.id} className={rate.id === currentRate?.id ? "font-medium" : ""}>
                          <td className="py-1">{formatDateBR(rate.effectiveDate)}</td>
                          <td className="py-1">R$ {formatCentavosAsReais(rate.ratePerKmCentavos)}/km</td>
                          <td className="py-1 text-zinc-500">{rate.note ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <form action={createRate} className="flex flex-wrap items-end gap-3 text-sm">
                  <input type="hidden" name="modelId" value={model.id} />
                  <label className="flex flex-col gap-1">
                    Nova tarifa (R$/km)
                    <input
                      name="rateReais"
                      placeholder="0,45"
                      required
                      className="w-28 rounded-md border px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    Vigente desde
                    <input name="effectiveDate" type="date" required className="rounded-md border px-3 py-2" />
                  </label>
                  <label className="flex flex-1 flex-col gap-1">
                    Observação (opcional)
                    <input name="note" placeholder="Ex: reajuste combustível" className="rounded-md border px-3 py-2" />
                  </label>
                  <button
                    type="submit"
                    className="rounded-md bg-brand-navy px-4 py-2 font-medium text-white hover:bg-brand-navy-light"
                  >
                    Salvar tarifa
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border bg-white p-6">
        <h2 className="mb-4 text-base font-semibold">Veículos ({vehicles.length})</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b">
            <tr className="text-zinc-500">
              <th className="px-2 py-2 font-medium">Placa</th>
              <th className="px-2 py-2 font-medium">Modelo</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className="border-b last:border-0">
                <td className="px-2 py-2 font-medium">{vehicle.plate}</td>
                <td className="px-2 py-2">
                  <form action={assignVehicleModel} className="flex items-center gap-2">
                    <input type="hidden" name="vehicleId" value={vehicle.id} />
                    <select
                      name="modelId"
                      defaultValue={vehicle.modelId ?? ""}
                      className="rounded-md border px-2 py-1"
                    >
                      <option value="">Sem modelo</option>
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="text-zinc-600 underline hover:text-zinc-900">
                      salvar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={2} className="px-2 py-4 text-zinc-500">
                  Nenhum veículo importado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
