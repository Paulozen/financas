"use client";

import clsx from "clsx";
import { useState } from "react";
import { diasNoMes, hojeISO } from "@/lib/datas";
import { valorConta } from "@/lib/painel";
import type { Ocorrencia } from "@/lib/tipos";
import { LinhaOcorrencia } from "./ocorrencias";

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Valor bem curto para caber na célula: "780", "5,9k", "12k". */
function curto(centavos: number): string {
  const v = centavos / 100;
  if (v < 1000) return String(Math.round(v));
  const k = v / 1000;
  return `${(k < 10 ? k.toFixed(1) : Math.round(k).toString()).replace(".", ",").replace(",0", "")}k`;
}

/**
 * Calendário do mês (ideia do Securo): cada dia mostra o que entra e o que sai;
 * pendentes ficam com marcação, atrasados em vermelho. Tocar no dia lista os lançamentos.
 */
export function CalendarioMes({
  mes,
  ocorrencias,
  aoAbrir,
  aoPagar,
}: {
  mes: string;
  ocorrencias: Ocorrencia[];
  aoAbrir: (o: Ocorrencia) => void;
  aoPagar: (o: Ocorrencia) => void;
}) {
  const hoje = hojeISO();
  const [ano, m] = mes.split("-").map(Number);
  const n = diasNoMes(ano, m);
  const primeiro = new Date(Date.UTC(ano, m - 1, 1)).getUTCDay();
  const [dia, setDia] = useState<string | null>(() => (hoje.startsWith(mes) ? hoje : null));

  const porDia = new Map<string, Ocorrencia[]>();
  for (const o of ocorrencias) porDia.set(o.vencimento, [...(porDia.get(o.vencimento) ?? []), o]);

  const celulas: (string | null)[] = [...Array(primeiro).fill(null)];
  for (let d = 1; d <= n; d++) celulas.push(`${mes}-${String(d).padStart(2, "0")}`);
  const doDia = dia ? (porDia.get(dia) ?? []) : [];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">
        {SEMANA.map((s, i) => (
          <span key={i}>{s}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {celulas.map((data, i) => {
          if (!data) return <span key={`v${i}`} />;
          const lista = (porDia.get(data) ?? []).filter((o) => o.status !== "cancelado");
          const entra = lista.filter((o) => o.tipo === "entrada").reduce((s, o) => s + valorConta(o), 0);
          const sai = lista.filter((o) => o.tipo === "saida").reduce((s, o) => s + valorConta(o), 0);
          const atrasado = lista.some((o) => o.status === "pendente" && o.vencimento < hoje);
          const pendente = lista.some((o) => o.status === "pendente");
          return (
            <button
              key={data}
              type="button"
              onClick={() => setDia(data === dia ? null : data)}
              aria-pressed={data === dia}
              aria-label={`Dia ${Number(data.slice(8))}: ${lista.length} lançamentos`}
              className={clsx(
                "flex min-h-14 min-w-0 flex-col items-center rounded-xl px-0.5 py-1 text-[10px] leading-tight transition-colors sm:min-h-16",
                data === dia ? "bg-marca-600 text-white" : lista.length ? "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60" : "hover:bg-slate-50 dark:hover:bg-slate-800/40",
              )}
            >
              <span className={clsx("text-xs font-semibold", data === hoje && data !== dia && "text-marca-600 dark:text-marca-400")}>
                {Number(data.slice(8))}
              </span>
              {entra > 0 && (
                <span className={clsx("valor-oculto max-w-full truncate", data === dia ? "text-white" : "text-emerald-600 dark:text-emerald-400")}>
                  +{curto(entra)}
                </span>
              )}
              {sai > 0 && (
                <span className={clsx("valor-oculto max-w-full truncate", data === dia ? "text-white/90" : "text-slate-600 dark:text-slate-300")}>
                  −{curto(sai)}
                </span>
              )}
              {pendente && <span className={clsx("mt-auto size-1.5 rounded-full", atrasado ? "bg-red-500" : "bg-amber-400")} aria-hidden />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-amber-400" aria-hidden /> pendente
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-red-500" aria-hidden /> atrasado
        </span>
      </p>
      {dia && (
        <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
          <p className="text-sm font-semibold">Dia {Number(dia.slice(8))}</p>
          {doDia.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">Nada neste dia.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {doDia.map((o) => (
                <LinhaOcorrencia key={o.id} o={o} aoAbrir={() => aoAbrir(o)} aoPagar={() => aoPagar(o)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
