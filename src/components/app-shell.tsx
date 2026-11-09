"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CalendarRange, Car, ChevronLeft, ChevronRight, LogOut, type LucideIcon } from "lucide-react";
import { logout } from "@/app/login/actions";

type NavLink = { href: string; label: string; icon: LucideIcon };
type NavSection = { label: string; links: NavLink[] };

const SECTIONS: NavSection[] = [
  { label: "Principal", links: [{ href: "/periodos", label: "Períodos", icon: CalendarRange }] },
  {
    label: "Cadastros",
    links: [
      { href: "/veiculos", label: "Veículos e tarifas", icon: Car },
      { href: "/feriados", label: "Feriados", icon: CalendarDays },
    ],
  },
];

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Mesma barra lateral do CRM da Raiar: escura, recolhida num trilho de ícones que abre ao passar o
 * mouse (ou ao fixar pela seta). A página pública do vendedor e a tela de login não têm menu.
 */
export function AppShell({
  children,
  adminName,
  adminNamePicker,
}: {
  children: ReactNode;
  adminName: string;
  adminNamePicker: ReactNode;
}) {
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  const pathname = usePathname() ?? "";

  if (pathname.startsWith("/vendedor") || pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  const compact = !pinned && !hovering;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-screen w-full">
      <aside
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={`sticky top-0 flex h-dvh shrink-0 flex-col bg-slate-900 text-slate-300 transition-[width] duration-200 ${
          compact ? "w-16" : "w-60"
        }`}
      >
        <div className="relative flex items-center justify-center overflow-hidden border-b border-slate-800 px-4 py-5">
          {!compact ? (
            <Image
              src="/raiar-logo-white.png"
              alt="Logo Raiar Orgânicos"
              width={930}
              height={390}
              unoptimized
              className="h-14 w-auto"
            />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden">
              <Image
                src="/raiar-logo-white.png"
                alt="Logo Raiar Orgânicos"
                width={930}
                height={390}
                unoptimized
                className="h-auto w-full object-contain"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => setPinned((value) => !value)}
            aria-label={compact ? "Expandir menu" : "Recolher menu"}
            className={`flex shrink-0 items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:text-white ${
              compact ? "absolute bottom-1 right-1" : "absolute right-2 top-1/2 -translate-y-1/2"
            }`}
          >
            {compact ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
          {SECTIONS.map((section, index) => (
            <div key={section.label} className={index > 0 ? "mt-3" : undefined}>
              {!compact ? (
                <div className="whitespace-nowrap px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {section.label}
                </div>
              ) : null}
              {section.links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={compact ? link.label : undefined}
                    className={`flex items-center gap-3 overflow-hidden whitespace-nowrap rounded-md px-3 py-2.5 text-sm text-slate-100 transition-colors hover:bg-slate-800 hover:text-white ${
                      compact ? "justify-center" : ""
                    } ${isActive(link.href) ? "bg-slate-700 font-medium text-white" : ""}`}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    {!compact ? <span className="truncate">{link.label}</span> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-slate-800 px-3 py-3">
          <div className={`mb-3 flex items-center gap-2.5 overflow-hidden ${compact ? "justify-center" : ""}`}>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {initialsOf(adminName)}
            </div>
            {!compact ? (
              <div className="overflow-hidden whitespace-nowrap">
                <div className="truncate text-sm font-semibold text-white">{adminName}</div>
                <div className="truncate text-xs text-slate-400">Gestão de Frota</div>
              </div>
            ) : null}
          </div>

          {!compact ? (
            <details className="mb-2 text-xs text-slate-400">
              <summary className="cursor-pointer select-none hover:text-white">Trocar usuário</summary>
              <div className="mt-2">{adminNamePicker}</div>
            </details>
          ) : null}

          <form action={logout}>
            <button
              type="submit"
              title={compact ? "Sair" : undefined}
              className={`flex w-full items-center rounded-md py-2 text-sm text-slate-100 transition-colors hover:bg-slate-800 hover:text-white ${
                compact ? "justify-center px-0" : "justify-start gap-2 px-2.5"
              }`}
            >
              <LogOut className="size-[18px] shrink-0" />
              {!compact ? <span>Sair</span> : null}
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-zinc-50">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
