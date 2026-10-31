"use client";

import clsx from "clsx";
import { CalendarClock, FileUp, Home, Inbox, List, LogOut, Menu, PartyPopper, PiggyBank, Settings, Tags, Trophy, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useApp } from "./app-contexto";

const principais = [
  { href: "/", rotulo: "Painel", Icone: Home },
  { href: "/lancamentos", rotulo: "Lançamentos", Icone: List },
  { href: "/compromissos", rotulo: "Compromissos", Icone: CalendarClock },
  { href: "/projetos", rotulo: "Projetos", Icone: PartyPopper },
];

const secundarios = [
  { href: "/caixa", rotulo: "Caixa de entrada", Icone: Inbox },
  { href: "/reservas", rotulo: "Reservas", Icone: PiggyBank },
  { href: "/racha", rotulo: "Caixa do racha", Icone: Trophy },
  { href: "/importar", rotulo: "Importar extrato", Icone: FileUp },
  { href: "/categorias", rotulo: "Categorias", Icone: Tags },
  { href: "/configuracoes", rotulo: "Configurações", Icone: Settings },
];

const daAbaMais = ["/mais", ...secundarios.map((s) => s.href)];

function useAtivo() {
  const caminho = usePathname();
  return (href: string) =>
    href === "/" ? caminho === "/" : href === "/mais" ? daAbaMais.some((p) => caminho.startsWith(p)) : caminho.startsWith(href);
}

/** Barra inferior (celular). */
export function NavInferior() {
  const ativo = useAtivo();
  const itens = [...principais, { href: "/mais", rotulo: "Mais", Icone: Menu }];
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/95"
    >
      <ul className="mx-auto flex max-w-2xl">
        {itens.map(({ href, rotulo, Icone }) => (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={ativo(href) ? "page" : undefined}
              className={clsx(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium min-[400px]:text-[11px]",
                ativo(href) ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500",
              )}
            >
              <Icone className="size-5" aria-hidden />
              <span className="max-w-full truncate">{rotulo}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Menu lateral (computador). */
export function BarraLateral() {
  const ativo = useAtivo();
  const { membro, casa } = useApp();
  const link = ({ href, rotulo, Icone }: (typeof principais)[number]) => (
    <li key={href}>
      <Link
        href={href}
        aria-current={ativo(href) ? "page" : undefined}
        className={clsx(
          "flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium",
          ativo(href)
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
        )}
      >
        <Icone className="size-5" aria-hidden />
        {rotulo}
      </Link>
    </li>
  );
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-8 flex items-center gap-2 px-2">
        <span className="rounded-xl bg-emerald-600 p-2 text-white">
          <Wallet className="size-5" aria-hidden />
        </span>
        <span className="text-lg font-bold">Finanças da Casa</span>
      </div>
      <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-6">
        <ul className="flex flex-col gap-1">{principais.map(link)}</ul>
        <div>
          <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Mais</p>
          <ul className="flex flex-col gap-1">{secundarios.map(link)}</ul>
        </div>
      </nav>
      <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="truncate px-3 text-sm font-medium">{membro.nome}</p>
        <p className="mb-2 truncate px-3 text-xs text-slate-500">{casa.nome}</p>
        <button
          type="button"
          onClick={() => supabase().auth.signOut()}
          className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
        >
          <LogOut className="size-5" aria-hidden />
          Sair
        </button>
      </div>
    </aside>
  );
}
