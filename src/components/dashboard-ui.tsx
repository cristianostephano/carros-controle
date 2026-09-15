import type { ReactNode } from "react";
import Link from "next/link";

export function DashboardCard({
  title,
  icon,
  badge,
  href,
  hrefLabel = "Ver tudo",
  children,
}: {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        {icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-cyan/15 text-brand-navy">
            {icon}
          </span>
        )}
        <h2 className="flex-1 truncate text-sm font-semibold text-zinc-800">{title}</h2>
        {badge}
        {href && (
          <Link href={href} className="shrink-0 text-xs font-medium text-brand-navy hover:underline">
            {hrefLabel} →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

const TILE_COLORS = {
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  violet: "text-violet-600",
  rose: "text-rose-600",
  navy: "text-brand-navy",
  zinc: "text-zinc-700",
} as const;

export function StatTile({
  value,
  label,
  color = "zinc",
}: {
  value: string | number;
  label: string;
  color?: keyof typeof TILE_COLORS;
}) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2.5 text-center">
      <div className={`text-xl font-bold ${TILE_COLORS[color]}`}>{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-zinc-500">{label}</div>
    </div>
  );
}

export function Badge({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "emerald" | "amber" }) {
  const toneClass = {
    zinc: "bg-zinc-100 text-zinc-600",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  }[tone];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>{children}</span>;
}
