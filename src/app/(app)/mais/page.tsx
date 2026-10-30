"use client";

import { ChevronRight, FileUp, LogOut, PiggyBank, Settings, Tags, Trophy } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/app-contexto";
import { Cabecalho } from "@/components/cabecalho";
import { supabase } from "@/lib/supabase";

const links = [
  { href: "/reservas", rotulo: "Reservas", Icone: PiggyBank },
  { href: "/racha", rotulo: "Caixa do racha", Icone: Trophy },
  { href: "/importar", rotulo: "Importar extrato", Icone: FileUp },
  { href: "/categorias", rotulo: "Categorias", Icone: Tags },
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
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {links.map(({ href, rotulo, Icone }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Icone className="size-5 text-emerald-600" aria-hidden />
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
