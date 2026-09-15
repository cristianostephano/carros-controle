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
    <div className="text-sm text-white/75">
      <div className="mb-0.5 font-semibold text-white">{currentName}</div>
      <div className="mb-3 text-xs text-white/50">Gestão</div>
      <form action={setAdminName} className="mb-2">
        <select
          name="name"
          defaultValue={currentName}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="w-full rounded-md border border-white/20 bg-white/5 px-2 py-1 text-xs text-white"
        >
          {allNames.map((n) => (
            <option key={n} value={n} className="text-black">
              {n}
            </option>
          ))}
        </select>
      </form>
      <form action={setAdminName} className="flex items-center gap-1">
        <input
          name="name"
          placeholder="novo nome"
          className="w-full rounded-md border border-white/20 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/40"
        />
        <button type="submit" className="shrink-0 text-xs text-white/60 underline hover:text-brand-yellow">
          usar
        </button>
      </form>
    </div>
  );
}
