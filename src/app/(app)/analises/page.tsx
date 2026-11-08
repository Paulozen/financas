"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp, useCarregar } from "@/components/app-contexto";
import { ListaAvisos } from "@/components/avisos";
import { Cabecalho } from "@/components/cabecalho";
import { MesAMes } from "@/components/graficos";
import { Faisca, MapaDinheiro } from "@/components/mapa-dinheiro";
import { Cartao, Carregando, Dinheiro, Erro, Titulo, Vazio } from "@/components/ui";
import { deslocarPeriodo, periodoDe, relatorio, type Periodo, type TipoPeriodo } from "@/lib/analises";
import { carregarBaseGastos, gastosDaVisao } from "@/lib/analises-dados";
import { ehEssencial, IconeCategoria } from "@/lib/categorias-visual";
import { formatarData, formatarDiaMes, hojeISO, mesDe, nomeMes, nomeMesCurto, somarMeses } from "@/lib/datas";
import { formatarReais } from "@/lib/dinheiro";
import { contaNaSobra, valorConta } from "@/lib/painel";

const TIPOS: { valor: TipoPeriodo; rotulo: string }[] = [
  { valor: "mes", rotulo: "Mês" },
  { valor: "trimestre", rotulo: "Trimestre" },
  { valor: "ano", rotulo: "Ano" },
];

function nomePeriodo(p: Periodo): string {
  if (p.tipo === "mes") return nomeMes(p.inicio);
  const ano = p.inicio.slice(0, 4);
  if (p.tipo === "ano") return ano;
  return `${Math.floor((Number(p.inicio.slice(5)) - 1) / 3) + 1}º trimestre de ${ano}`;
}

const pct = (x: number) => `${x > 0 ? "+" : ""}${Math.round(x * 100)}%`;

export default function Analises() {
  const { casa, mes, visao, categorias } = useApp();
  const hoje = hojeISO();
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDe("mes", mes));
  const { dados, erro, carregando } = useCarregar("analises", () => carregarBaseGastos(casa.id));

  const cab = <Cabecalho titulo="Análises" />;
  if (!dados) return carregando ? (<>{cab}<Carregando /></>) : (<>{cab}<Erro mensagem={erro} /></>);

  const { ocorrencias, gastos, porDia } = gastosDaVisao(dados, visao);
  const r = relatorio({ ocorrencias, gastos, porDia, categorias, periodo, hoje, formatar: formatarReais, ehEssencial });
  const cat = (id: string | null) => categorias.find((c) => c.id === id);
  const emAndamento = mesDe(hoje) >= periodo.inicio && mesDe(hoje) <= periodo.fim;
  // Tendência: gasto dos 6 meses até o fim do período, por categoria.
  const meses6 = [5, 4, 3, 2, 1, 0].map((i) => somarMeses(periodo.fim, -i));
  const tendencia = (id: string | null) => meses6.map((m) => gastos.filter((g) => g.mes === m && g.categoria_id === id).reduce((s, g) => s + g.valor, 0));
  // Mapa do dinheiro: entradas por categoria -> saídas por categoria (6 maiores + outras) e sobra.
  const entradasCat = new Map<string | null, number>();
  for (const o of ocorrencias)
    if (o.tipo === "entrada" && contaNaSobra(o) && mesDe(o.vencimento) >= periodo.inicio && mesDe(o.vencimento) <= periodo.fim)
      entradasCat.set(o.categoria_id, (entradasCat.get(o.categoria_id) ?? 0) + valorConta(o));
  const fluxoE = [...entradasCat.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, valor]) => ({ nome: cat(id)?.nome ?? "Sem categoria", valor, cor: cat(id)?.cor ?? "#94a3b8" }));
  const maioresS = r.categorias.slice(0, 6);
  const restoS = r.categorias.slice(6).reduce((s, c) => s + c.total, 0);
  const fluxoS = [
    ...maioresS.map((c) => ({ nome: cat(c.categoria_id)?.nome ?? "Sem categoria", valor: c.total, cor: cat(c.categoria_id)?.cor ?? "#94a3b8" })),
    ...(restoS > 0 ? [{ nome: "Outras", valor: restoS, cor: "#94a3b8" }] : []),
  ];

  return (
    <>
      {cab}
      <Cartao className="mb-4">
        <div role="tablist" className="mb-3 flex justify-around">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              role="tab"
              aria-selected={periodo.tipo === t.valor}
              onClick={() => setPeriodo(periodoDe(t.valor, periodo.tipo === "mes" ? periodo.inicio : mesDe(hoje) <= periodo.fim && mesDe(hoje) >= periodo.inicio ? mesDe(hoje) : periodo.inicio))}
              className={clsx(
                "relative min-h-9 px-3 text-sm font-semibold",
                periodo.tipo === t.valor
                  ? "text-slate-900 after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-marca-600 dark:text-white"
                  : "text-slate-500",
              )}
            >
              {t.rotulo}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setPeriodo(deslocarPeriodo(periodo, -1))}
            aria-label="Período anterior"
            className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 dark:bg-slate-800"
          >
            <ChevronLeft className="size-5" />
          </button>
          <p className="truncate text-base font-semibold first-letter:uppercase">{nomePeriodo(periodo)}</p>
          <button
            type="button"
            onClick={() => setPeriodo(deslocarPeriodo(periodo, 1))}
            aria-label="Próximo período"
            className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 dark:bg-slate-800"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </Cartao>

      {r.entradas === 0 && r.saidas === 0 ? (
        <Vazio titulo="Nada neste período" texto="Escolha outro período ou cadastre entradas e saídas." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <Cartao>
              <p className="text-sm text-slate-500">{emAndamento ? "Deve sobrar" : "Sobrou"}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Dinheiro
                  valor={r.sobra}
                  className={clsx("numero-grande text-4xl font-bold", r.sobra >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}
                />
                {r.taxa !== null && (
                  <span className="rounded-full bg-marca-50 px-2.5 py-0.5 text-xs font-semibold text-marca-700 dark:bg-marca-950 dark:text-marca-300">
                    {Math.round(r.taxa * 100)}% das entradas
                  </span>
                )}
              </div>
              {r.taxa !== null && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-marca-600 to-emerald-500"
                    style={{ width: `${Math.max(0, Math.min(100, r.taxa * 100))}%` }}
                  />
                </div>
              )}
              <dl className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <Linha rotulo="Entradas">
                  <Dinheiro valor={r.entradas} className="font-semibold text-emerald-600 dark:text-emerald-400" />
                </Linha>
                <Linha
                  rotulo={
                    <>
                      Saídas{" "}
                      {r.variacaoSaidas !== null && Math.abs(r.variacaoSaidas) >= 0.01 && (
                        <span
                          className={clsx(
                            "ml-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                            r.variacaoSaidas > 0 ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
                          )}
                          title="Comparado com o período anterior"
                        >
                          {pct(r.variacaoSaidas)}
                        </span>
                      )}
                    </>
                  }
                >
                  <Dinheiro valor={r.saidas} className="font-semibold" />
                </Linha>
                <Linha rotulo="Média por dia (gasto realizado)">
                  <Dinheiro valor={r.mediaDia} className="font-semibold" />
                </Linha>
                {r.diaMaisCaro && (
                  <Linha rotulo={`Dia mais caro · ${formatarDiaMes(r.diaMaisCaro.data)}`}>
                    <Dinheiro valor={r.diaMaisCaro.valor} className="font-semibold" />
                  </Linha>
                )}
                <Linha rotulo="Período anterior: sobra">
                  <Dinheiro valor={r.anterior.sobra} sinal className="font-semibold" />
                </Linha>
              </dl>
            </Cartao>

            {r.avisos.length > 0 && (
              <Cartao>
                <Titulo>Vale sua atenção</Titulo>
                <ListaAvisos avisos={r.avisos} />
              </Cartao>
            )}

            {r.limites.length > 0 && (
              <Cartao>
                <Titulo
                  acao={
                    <Link href="/categorias" className="text-sm font-medium text-marca-600 dark:text-marca-400">
                      Editar
                    </Link>
                  }
                >
                  Limites por categoria
                </Titulo>
                <ul className="flex flex-col gap-3">
                  {r.limites.map((l) => {
                    const c = cat(l.categoria_id);
                    const parte = l.total / l.limite;
                    return (
                      <li key={l.categoria_id} className="flex items-center gap-3">
                        <IconeCategoria categoria={c} tamanho="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between gap-2 text-sm">
                            <span className="truncate font-medium">{c?.nome}</span>
                            <span className="shrink-0 text-xs text-slate-500">
                              <span className="valor-oculto">{formatarReais(l.total)}</span> de <span className="valor-oculto">{formatarReais(l.limite)}</span>
                            </span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={clsx("h-full rounded-full", parte > 1 ? "bg-red-500" : parte >= 0.9 ? "bg-amber-500" : "bg-marca-500")}
                              style={{ width: `${Math.min(100, parte * 100)}%` }}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Cartao>
            )}

            {r.fixos.length > 0 && (
              <Cartao>
                <Titulo>Gastos que se repetem</Titulo>
                <p className="mb-2 text-xs text-slate-500">
                  Aparecem todo mês e não estão cadastrados. Cadastre em{" "}
                  <Link href="/lancamentos" className="underline">
                    Lançamentos → Recorrentes
                  </Link>{" "}
                  para entrarem na previsão.
                </p>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {r.fixos.map((f) => (
                    <li key={f.descricao} className="flex items-center gap-3 py-2">
                      <IconeCategoria categoria={cat(f.categoria_id)} tamanho="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{f.descricao}</span>
                        <span className="text-xs text-slate-500">{f.meses} dos últimos 4 meses</span>
                      </span>
                      <span className="text-sm font-semibold whitespace-nowrap">
                        <span className="valor-oculto">{formatarReais(f.media)}</span>
                        <span className="text-xs font-normal text-slate-500">/mês</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Cartao>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <Cartao>
              <Titulo>Para onde foi o dinheiro</Titulo>
              {r.categorias.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma saída no período.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                  {r.categorias.map((c) => {
                    const v = c.media > 0 ? c.total / c.media - 1 : null;
                    return (
                      <li key={c.categoria_id ?? "sem"} className="flex items-center gap-3 py-2.5">
                        <IconeCategoria categoria={cat(c.categoria_id)} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">{cat(c.categoria_id)?.nome ?? "Sem categoria"}</span>
                            <span className="ml-auto hidden min-[380px]:block" title="Últimos 6 meses">
                              <Faisca valores={tendencia(c.categoria_id)} cor={cat(c.categoria_id)?.cor ?? "#94a3b8"} />
                            </span>
                            <Dinheiro valor={c.total} className="text-sm font-bold" />
                          </span>
                          <span className="flex justify-between gap-2 text-[11px] text-slate-500">
                            <span>{Math.round(c.parte * 100)}% dos gastos</span>
                            {v !== null && Math.abs(v) >= 0.05 && (
                              <span className={v > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>{pct(v)} vs média</span>
                            )}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {r.naoEssenciais.total > 0 && (
                <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  Não essenciais: <strong className="valor-oculto">{formatarReais(r.naoEssenciais.total)}</strong> ({Math.round(r.naoEssenciais.parte * 100)}% dos gastos).
                  Marque o que é essencial em{" "}
                  <Link href="/categorias" className="underline">
                    Categorias
                  </Link>
                  .
                </p>
              )}
            </Cartao>

            {fluxoE.length > 0 && fluxoS.length > 0 && (
              <Cartao>
                <Titulo>Mapa do dinheiro</Titulo>
                <p className="-mt-2 mb-2 text-xs text-slate-500">De onde veio e para onde foi no período.</p>
                <MapaDinheiro entradas={fluxoE} saidas={fluxoS} />
              </Cartao>
            )}

            <Cartao>
              <Titulo>Maiores gastos</Titulo>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {r.maiores.map((g) => (
                  <li key={g.chave} className="flex items-center gap-3 py-2">
                    <IconeCategoria categoria={cat(g.categoria_id)} tamanho="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{g.descricao}</span>
                      <span className="text-xs text-slate-500">
                        {formatarData(g.data)}
                        {g.origem === "cartao" && " · cartão"}
                        {!g.realizado && " · previsto"}
                      </span>
                    </span>
                    <Dinheiro valor={g.valor} className="text-sm font-semibold" />
                  </li>
                ))}
              </ul>
            </Cartao>

            <Cartao>
              <Titulo>Mês a mês</Titulo>
              <MesAMes dados={r.mesAMes} />
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-xs text-slate-500">Ver em tabela</summary>
                <div className="overflow-x-auto">
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        <th className="font-medium">Mês</th>
                        <th className="text-right font-medium">Entradas</th>
                        <th className="text-right font-medium">Saídas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.mesAMes.map((m) => (
                        <tr key={m.mes} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="py-1">{nomeMesCurto(m.mes)}</td>
                          <td className="text-right">
                            <Dinheiro valor={m.entradas} />
                          </td>
                          <td className="text-right">
                            <Dinheiro valor={m.saidas} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </Cartao>
          </div>
        </div>
      )}
    </>
  );
}

function Linha({ rotulo, children }: { rotulo: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="min-w-0 text-slate-500">{rotulo}</dt>
      <dd className="shrink-0">{children}</dd>
    </div>
  );
}
