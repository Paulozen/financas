"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { hojeISO, mesDe, nomeMes, somarMeses } from "@/lib/datas";
import { CASAL } from "@/lib/tipos";
import { useApp } from "./app-contexto";

/** Título da tela + seletor global de visão (membro 1 / membro 2 / Casal). */
export function Cabecalho({ titulo, acao, semVisao }: { titulo: string; acao?: ReactNode; semVisao?: boolean }) {
  const { membros, visao, setVisao } = useApp();
  const opcoes = [...membros.map((m) => ({ id: m.id, nome: m.nome })), { id: CASAL, nome: "Casal" }];
  return (
    <header className="mb-4 flex flex-col gap-3 lg:mb-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold lg:text-2xl">{titulo}</h1>
        {acao}
      </div>
      {!semVisao && (
        <div role="radiogroup" aria-label="Visão" className="flex gap-1 rounded-xl bg-slate-200 p-1 lg:w-96 dark:bg-slate-800">
          {opcoes.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={visao === o.id}
              onClick={() => setVisao(o.id)}
              className={clsx(
                "min-h-9 flex-1 truncate rounded-lg px-2 text-sm font-medium",
                visao === o.id ? "bg-white shadow-sm dark:bg-slate-950" : "text-slate-600 dark:text-slate-400",
              )}
            >
              {o.nome}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

export function SeletorMes() {
  const { mes, setMes } = useApp();
  const atual = mesDe(hojeISO());
  return (
    <div className="mb-4 flex items-center justify-between lg:justify-start lg:gap-2">
      <button
        type="button"
        onClick={() => setMes(somarMeses(mes, -1))}
        aria-label="Mês anterior"
        className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-800"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => setMes(atual)}
        className="text-base font-semibold first-letter:uppercase lg:min-w-48 lg:text-lg"
        title="Voltar para o mês atual"
      >
        {nomeMes(mes)}
      </button>
      <button
        type="button"
        onClick={() => setMes(somarMeses(mes, 1))}
        aria-label="Próximo mês"
        className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-800"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
