"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { formatDateBR, formatDurationHMS, formatTimeBR } from "@/lib/dates";

export type TripRowData = {
  id: string;
  startDateTime: Date;
  endDateTime: Date;
  vehiclePlate: string;
  salespersonNickname: string;
  originAddress: string | null;
  destAddress: string | null;
  km: number | null;
  durationSeconds: number | null;
  autoClassification: string;
  autoClassificationReason: string;
  status: string;
};

const columnHelper = createColumnHelper<TripRowData>();

const CLASSIFICATION_LABEL: Record<string, string> = {
  PROFISSIONAL: "Profissional",
  PESSOAL: "Pessoal",
  EM_ANALISE: "Em análise",
  NAO_CLASSIFICADO: "Não classificado",
};

const CLASSIFICATION_STYLE: Record<string, string> = {
  PROFISSIONAL: "bg-emerald-100 text-emerald-800",
  PESSOAL: "bg-amber-100 text-amber-800",
  EM_ANALISE: "bg-orange-100 text-orange-800",
  NAO_CLASSIFICADO: "bg-zinc-100 text-zinc-600",
};

const columns = [
  columnHelper.accessor("startDateTime", {
    header: "Data",
    cell: (info) => formatDateBR(info.getValue()),
  }),
  columnHelper.accessor((row) => row, {
    id: "horario",
    header: "Início - Fim",
    cell: (info) => {
      const row = info.getValue();
      return `${formatTimeBR(row.startDateTime)} - ${formatTimeBR(row.endDateTime)}`;
    },
    enableSorting: false,
  }),
  columnHelper.accessor("salespersonNickname", { header: "Vendedor" }),
  columnHelper.accessor("vehiclePlate", { header: "Veículo" }),
  columnHelper.accessor("originAddress", {
    header: "Origem",
    cell: (info) => info.getValue() ?? "-",
  }),
  columnHelper.accessor("destAddress", {
    header: "Destino",
    cell: (info) => info.getValue() ?? "-",
  }),
  columnHelper.accessor("km", {
    header: "Km",
    cell: (info) => (info.getValue() != null ? info.getValue()!.toFixed(2) : "-"),
  }),
  columnHelper.accessor("durationSeconds", {
    header: "Duração",
    cell: (info) => formatDurationHMS(info.getValue()),
  }),
  columnHelper.accessor("autoClassification", {
    header: "Classificação",
    cell: (info) => {
      const value = info.getValue();
      return (
        <span
          title={info.row.original.autoClassificationReason}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASSIFICATION_STYLE[value] ?? ""}`}
        >
          {CLASSIFICATION_LABEL[value] ?? value}
        </span>
      );
    },
  }),
];

export function TripTable({ data }: { data: TripRowData[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "startDateTime", desc: false }]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-md border bg-white">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b bg-zinc-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium text-zinc-600"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted() as string] ?? ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-zinc-50">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="whitespace-nowrap px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
