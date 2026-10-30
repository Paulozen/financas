"use client";

import clsx from "clsx";
import { CalendarClock, Home, List, Menu, PartyPopper } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const itens = [
  { href: "/", rotulo: "Painel", Icone: Home },
  { href: "/lancamentos", rotulo: "Lançamentos", Icone: List },
  { href: "/compromissos", rotulo: "Compromissos", Icone: CalendarClock },
  { href: "/projetos", rotulo: "Projetos", Icone: PartyPopper },
  { href: "/mais", rotulo: "Mais", Icone: Menu },
];

const daAbaMais = ["/mais", "/reservas", "/racha", "/importar", "/categorias", "/configuracoes"];

export function NavInferior() {
  const caminho = usePathname();
  const ativo = (href: string) =>
    href === "/"
      ? caminho === "/"
      : href === "/mais"
        ? daAbaMais.some((p) => caminho.startsWith(p))
        : caminho.startsWith(href);

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
    >
      <ul className="mx-auto flex max-w-2xl">
        {itens.map(({ href, rotulo, Icone }) => (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={ativo(href) ? "page" : undefined}
              className={clsx(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                ativo(href) ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500",
              )}
            >
              <Icone className="size-5" aria-hidden />
              {rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
