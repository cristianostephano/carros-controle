"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const BLUE = "#254d69"; // brand-navy da Raiar Orgânicos

function EmptyState({ height }: { height: number }) {
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center text-sm text-zinc-400"
    >
      Sem dados ainda
    </div>
  );
}

export function KmPorVendedorChart({ data }: { data: { name: string; km: number }[] }) {
  if (data.length === 0) return <EmptyState height={280} />;
  // Altura cresce com a quantidade de vendedores — com altura fixa, uma lista longa
  // espreme as barras/nomes até ficarem ilegíveis (cada vendedor precisa de espaço mínimo).
  const height = Math.max(280, data.length * 32);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <CartesianGrid horizontal={false} stroke="#e5e5e5" />
        <XAxis type="number" tick={{ fontSize: 12 }} stroke="#a1a1aa" />
        <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} stroke="#a1a1aa" interval={0} />
        <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} km`, "Km"]} />
        <Bar dataKey="km" fill={BLUE} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function KmPorDiaChart({ data }: { data: { day: string; km: number }[] }) {
  if (data.length === 0) return <EmptyState height={240} />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} stroke="#e5e5e5" />
        <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#a1a1aa" />
        <YAxis tick={{ fontSize: 12 }} stroke="#a1a1aa" />
        <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} km`, "Km"]} />
        <Bar dataKey="km" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
