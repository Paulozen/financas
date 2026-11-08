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
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{titulo}</h1>
        {acao}
      </div>
      {!semVisao && (
        <div role="radiogroup" aria-label="Visão" className="flex gap-1 rounded-2xl bg-slate-200/70 p-1 lg:w-96 dark:bg-slate-800/80">
          {opcoes.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={visao === o.id}
              onClick={() => setVisao(o.id)}
              className={clsx(
                "min-h-9 flex-1 truncate rounded-xl px-2 text-sm font-semibold transition-colors",
                visao === o.id ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-500 dark:text-slate-400",
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

/** Seletor de visão dentro da faixa de destaque (fundo escuro). */
export function SeletorVisaoFaixa() {
  const { membros, visao, setVisao } = useApp();
  const opcoes = [...membros.map((m) => ({ id: m.id, nome: m.nome })), { id: CASAL, nome: "Casal" }];
  return (
    <div role="radiogroup" aria-label="Visão" className="flex min-w-0 gap-1 rounded-2xl bg-white/10 p-1 ring-1 ring-white/15 backdrop-blur">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={visao === o.id}
          onClick={() => setVisao(o.id)}
          className={clsx(
            "min-h-8 min-w-0 truncate rounded-xl px-3 text-sm font-semibold transition-colors",
            visao === o.id ? "bg-white text-marca-900 shadow-sm" : "text-white/75 hover:text-white",
          )}
        >
          {o.nome}
        </button>
      ))}
    </div>
  );
}

export function SeletorMes({ naFaixa }: { naFaixa?: boolean } = {}) {
  const { mes, setMes } = useApp();
  const atual = mesDe(hojeISO());
  if (naFaixa)
    return (
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior" className="rounded-full p-1.5 text-white/80 hover:bg-white/10">
          <ChevronLeft className="size-5" />
        </button>
        <button type="button" onClick={() => setMes(atual)} className="min-w-0 truncate text-sm font-semibold text-white first-letter:uppercase" title="Voltar para o mês atual">
          {nomeMes(mes)}
        </button>
        <button type="button" onClick={() => setMes(somarMeses(mes, 1))} aria-label="Próximo mês" className="rounded-full p-1.5 text-white/80 hover:bg-white/10">
          <ChevronRight className="size-5" />
        </button>
      </div>
    );
  return (
    <div className="mb-4 flex items-center justify-between lg:justify-start lg:gap-2">
      <button
        type="button"
        onClick={() => setMes(somarMeses(mes, -1))}
        aria-label="Mês anterior"
        className="rounded-full bg-white p-2 shadow-folha hover:bg-slate-50 dark:bg-slate-900 dark:shadow-none dark:hover:bg-slate-800"
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
        className="rounded-full bg-white p-2 shadow-folha hover:bg-slate-50 dark:bg-slate-900 dark:shadow-none dark:hover:bg-slate-800"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
