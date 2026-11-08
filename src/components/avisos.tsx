"use client";

import clsx from "clsx";
import { ChartPie, Gauge, PiggyBank, Repeat, Scissors, TrendingDown, TrendingUp } from "lucide-react";
import type { Aviso } from "@/lib/analises";

const ICONES = {
  cofre: PiggyBank,
  grafico: TrendingDown,
  seta: TrendingUp,
  limite: Gauge,
  corte: Scissors,
  pizza: ChartPie,
  repetir: Repeat,
};

const TONS = {
  bom: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
  atencao: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400",
  info: "bg-marca-50 text-marca-600 dark:bg-marca-950/60 dark:text-marca-300",
};

/** Lista de avisos ("Vale sua atenção"), cada um com "Ver como foi calculado". */
export function ListaAvisos({ avisos }: { avisos: Aviso[] }) {
  return (
    <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
      {avisos.map((a, i) => {
        const Icone = ICONES[a.icone];
        return (
          <li key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <span className={clsx("flex size-10 shrink-0 items-center justify-center rounded-[0.9rem]", TONS[a.tom])} aria-hidden>
              <Icone className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="valor-oculto text-sm font-semibold break-words">{a.titulo}</p>
              <p className="valor-oculto text-xs text-slate-500 break-words">{a.texto}</p>
              <details className="mt-1 text-xs">
                <summary className="cursor-pointer font-medium text-marca-600 dark:text-marca-400">Ver como foi calculado</summary>
                <p className="valor-oculto mt-1 rounded-xl bg-slate-50 p-2 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">{a.como}</p>
              </details>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
