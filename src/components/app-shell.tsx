"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import type { ReactNode, SVGProps } from "react";

function Icon({ path, ...props }: { path: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  dashboard: "M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h8v8H3v-8zm10 3h8v5h-8v-5z",
  car: "M5 17h14M5 17a2 2 0 1 0 4 0m6 0a2 2 0 1 0 4 0M5 17V9l2-4h10l2 4v8M3 12h18",
  calendar: "M8 2v4M16 2v4M3 9h18M4 5h16v15H4V5z",
};

const NAV_SECTIONS: { label: string; items: { href: string; label: string; icon: keyof typeof ICONS }[] }[] = [
  { label: "Principal", items: [{ href: "/periodos", label: "Períodos", icon: "dashboard" }] },
  {
    label: "Cadastros",
    items: [
      { href: "/veiculos", label: "Veículos e tarifas", icon: "car" },
      { href: "/feriados", label: "Feriados", icon: "calendar" },
    ],
  },
];

/**
 * A página pública do vendedor (/vendedor/[token]) não deve ter o menu
 * administrativo — precisa ser simples e restrita ao próprio vendedor.
 */
export function AppShell({ children, adminNamePicker }: { children: ReactNode; adminNamePicker: ReactNode }) {
  const pathname = usePathname();
  const isVendorPage = pathname?.startsWith("/vendedor");
  const isLoginPage = pathname?.startsWith("/login");

  if (isVendorPage || isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full">
      <aside className="flex w-60 shrink-0 flex-col bg-brand-navy text-white">
        <div className="px-5 pb-4 pt-6">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold">Raiar</span>
            <span className="text-lg text-brand-yellow">·</span>
          </div>
          <div className="mb-3 text-[11px] font-medium tracking-wide text-white/60">
            ORGÂNICOS · GESTÃO DE FROTA
          </div>
          <span className="inline-block rounded bg-brand-yellow px-2 py-0.5 text-[11px] font-bold text-brand-navy">
            PRODUÇÃO
          </span>
        </div>

        <nav className="flex-1 space-y-5 px-3 py-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="mb-1 px-2 text-[10px] font-semibold tracking-wider text-white/40">
                {section.label.toUpperCase()}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                        active ? "bg-brand-cyan/20 text-brand-cyan" : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon path={ICONS[item.icon]} className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">{adminNamePicker}</div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col bg-zinc-50">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
