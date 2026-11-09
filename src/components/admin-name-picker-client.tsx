"use client";

import { setAdminName } from "@/lib/adminName";

export function AdminNamePickerClient({
  currentName,
  names,
}: {
  currentName: string;
  names: string[];
}) {
  const allNames = names.includes(currentName) ? names : [currentName, ...names];

  return (
    <div className="text-xs text-slate-300">
      <form action={setAdminName} className="mb-2">
        <select
          name="name"
          defaultValue={currentName}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white"
        >
          {allNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </form>
      <form action={setAdminName} className="flex items-center gap-1">
        <input
          name="name"
          placeholder="novo nome"
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white placeholder:text-slate-500"
        />
        <button type="submit" className="shrink-0 text-xs text-slate-400 underline hover:text-white">
          usar
        </button>
      </form>
    </div>
  );
}
