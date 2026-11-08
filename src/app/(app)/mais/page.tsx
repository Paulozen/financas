"use client";

import { ChartPie, ChevronRight, Tag, Wand2, FileUp, Inbox, LogOut, PiggyBank, Settings, Tags, Trophy } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/app-contexto";
import { Cabecalho } from "@/components/cabecalho";
import { supabase } from "@/lib/supabase";

const links = [
  { href: "/analises", rotulo: "Análises", Icone: ChartPie },
  { href: "/caixa", rotulo: "Caixa de entrada", Icone: Inbox },
  { href: "/reservas", rotulo: "Reservas", Icone: PiggyBank },
  { href: "/racha", rotulo: "Caixa do racha", Icone: Trophy },
  { href: "/importar", rotulo: "Importar extrato", Icone: FileUp },
  { href: "/categorias", rotulo: "Categorias", Icone: Tags },
  { href: "/categorizar", rotulo: "Gastos sem categoria", Icone: Tag },
  { href: "/regras", rotulo: "Regras de categorização", Icone: Wand2 },
  { href: "/configuracoes", rotulo: "Configurações", Icone: Settings },
];

export default function Mais() {
  const { membro, casa } = useApp();
  return (
    <>
      <Cabecalho titulo="Mais" semVisao />
      <p className="mb-4 text-sm text-slate-500">
        {membro.nome} · {casa.nome}
      </p>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-folha dark:divide-slate-800 dark:bg-slate-900 dark:shadow-none">
        {links.map(({ href, rotulo, Icone }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-slate-50 dark:hover:bg-slate-800">
              <span className="flex size-9 items-center justify-center rounded-xl bg-marca-50 dark:bg-marca-950/60"><Icone className="size-5 text-marca-600 dark:text-marca-400" aria-hidden /></span>
              <span className="flex-1">{rotulo}</span>
              <ChevronRight className="size-4 text-slate-400" aria-hidden />
            </Link>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => supabase().auth.signOut()}
            className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-red-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <LogOut className="size-5" aria-hidden />
            Sair
          </button>
        </li>
      </ul>
    </>
  );
}
