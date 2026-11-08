"use client";

import clsx from "clsx";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, ChartPie, ChevronRight, Eye, EyeOff, Inbox, PiggyBank, Trophy, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { daVisao, useApp, useCarregar } from "@/components/app-contexto";
import { ListaAvisos } from "@/components/avisos";
import { Cabecalho, SeletorMes, SeletorVisaoFaixa } from "@/components/cabecalho";
import { BarrasDiarias, CurvaRitmo, Rosca } from "@/components/graficos";
import { LinhaOcorrencia, ModalOcorrencia, ModalPagar } from "@/components/ocorrencias";
import { Abas, Barra, Cartao, Carregando, Dinheiro, Erro, Titulo, Vazio } from "@/components/ui";
import { periodoDe, relatorio, ritmoDoMes, type Aviso, type Gasto, type Ritmo } from "@/lib/analises";
import { carregarBaseGastos, gastosDaVisao } from "@/lib/analises-dados";
import { ehEssencial, IconeCategoria } from "@/lib/categorias-visual";
import { resumoContrato, resumoDivida } from "@/lib/compromissos";
import { hojeISO, mesDe, nomeMesCurto, somarMeses } from "@/lib/datas";
import { buscarTodos } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { reaisCurto, useCoresGrafico } from "@/lib/graficos";
import { alternarOcultar, useOcultar } from "@/lib/ocultar";
import { projecao, saldoEmConta, sobraDoMes, valorConta, vencimentos, type MesProjecao } from "@/lib/painel";
import { avisosConexao, COMO_RENOVAR, type EstadoItem } from "@/lib/pluggy/conexoes";
import { resumoProjeto } from "@/lib/projetos";
import { saldoRacha } from "@/lib/racha";
import { resumoGuardado } from "@/lib/reservas";
import type { Contrato, Divida, Ocorrencia, Projeto, ProjetoItem, RachaMovimento, Reserva, ReservaSaldo } from "@/lib/tipos";

export default function Painel() {
  const { casa, mes, visao, categorias, nomeDono } = useApp();
  const [aberta, setAberta] = useState<Ocorrencia | null>(null);
  const [pagando, setPagando] = useState<Ocorrencia | null>(null);
  const hoje = hojeISO();

  const { dados, erro, carregando } = useCarregar("painel", async () => {
    const [base, contratos, dividas, projetos, itens, reservas, saldos, racha, aRevisar, itensBancos] = await Promise.all([
      carregarBaseGastos(casa.id),
      buscarTodos<Contrato>("contratos", casa.id),
      buscarTodos<Divida>("dividas", casa.id),
      buscarTodos<Projeto>("projetos", casa.id, (q) => q.eq("status", "ativo")),
      buscarTodos<ProjetoItem>("projeto_itens", casa.id),
      buscarTodos<Reserva>("reservas", casa.id),
      buscarTodos<ReservaSaldo>("reserva_saldos", casa.id),
      casa.racha_ativo ? buscarTodos<RachaMovimento>("racha_movimentos", casa.id) : Promise.resolve([]),
      buscarTodos<{ conta_externa_id: string }>("transacoes_externas", casa.id, (q) => q.eq("situacao", "pendente"), "data"),
      buscarTodos<EstadoItem>("pluggy_itens", casa.id),
    ]);
    // Caixa de entrada: só contas correntes ativas.
    const bancosAtivos = new Set(base.contasExternas.filter((c) => c.ativa && c.tipo === "BANK").map((c) => c.id));
    const pendentesCaixa = aRevisar.filter((t) => bancosAtivos.has(t.conta_externa_id)).length;
    return { base, contratos, dividas, projetos, itens, reservas, saldos, racha, pendentesCaixa, itensBancos };
  });

  if (!dados)
    return (
      <>
        <Cabecalho titulo="Painel" />
        {carregando ? <Carregando /> : <Erro mensagem={erro} />}
      </>
    );

  const todas = dados.base.ocorrencias;
  const { ocorrencias, gastos, porDia } = gastosDaVisao(dados.base, visao);
  const semNada = todas.length === 0;
  const sobra = sobraDoMes(ocorrencias, mes);
  const saldoHoje = saldoEmConta(
    dados.base.contasExternas,
    visao,
    casa.saldo_conta !== null && casa.saldo_conta_data ? { valor: casa.saldo_conta, data: casa.saldo_conta_data } : null,
  );
  const proj = projecao(ocorrencias, hoje, saldoHoje);
  const venc = vencimentos(ocorrencias, hoje);
  const avisosBancos = avisosConexao(dados.itensBancos, hoje);
  const guardado = resumoGuardado(dados.reservas, dados.saldos, dados.base.contasExternas, visao);
  const rel = relatorio({
    ocorrencias,
    gastos,
    porDia,
    categorias,
    periodo: periodoDe("mes", mes),
    hoje,
    formatar: formatarReais,
    ehEssencial,
  });
  const ritmo = ritmoDoMes(porDia, mes, hoje);

  const progresso = [
    ...daVisao(dados.contratos, visao).map((c) => {
      const r = resumoContrato(c, todas);
      return { id: c.id, nome: c.nome, pago: r.totalPago, total: c.valor_total, href: `/compromissos/parcelado/${c.id}`, ativo: r.restantes > 0 };
    }),
    ...daVisao(dados.dividas, visao).map((d) => {
      const r = resumoDivida(d, todas);
      return { id: d.id, nome: d.descricao, pago: r.pago, total: d.valor_total, href: `/compromissos/divida/${d.id}`, ativo: !r.quitada };
    }),
    ...daVisao(dados.projetos, visao).map((p) => {
      const r = resumoProjeto(
        dados.itens.filter((i) => i.projeto_id === p.id),
        todas.filter((o) => o.origem_tipo === "parcela_projeto"),
      );
      return { id: p.id, nome: p.nome, pago: r.pago, total: r.contratado, href: `/projetos/${p.id}`, ativo: true };
    }),
  ].filter((p) => p.ativo);

  return (
    <>
      <h1 className="sr-only">Painel</h1>
      <FaixaDestaque
        guardado={guardado}
        entradas={sobra.previsto.entradas}
        recebido={sobra.realizado.entradas}
        saidas={sobra.previsto.saidas}
        pago={sobra.realizado.saidas}
        sobra={sobra.previsto.saldo}
        atalhos={
          <>
            {dados.pendentesCaixa > 0 && (
              <Atalho href="/caixa" Icone={Inbox}>
                Caixa de entrada <strong className="rounded-full bg-white px-1.5 text-xs text-marca-800">{dados.pendentesCaixa}</strong>
              </Atalho>
            )}
            {casa.racha_ativo && (
              <Atalho href="/racha" Icone={Trophy}>
                Racha <span className="valor-oculto font-semibold">{formatarReais(saldoRacha(dados.racha))}</span>
              </Atalho>
            )}
            <Atalho href="/analises" Icone={ChartPie}>
              Análises
            </Atalho>
            <Atalho href="/reservas" Icone={PiggyBank}>
              Reservas
            </Atalho>
          </>
        }
      />

      {avisosBancos.length > 0 && (
        <div
          role="alert"
          className="mt-4 rounded-3xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" aria-hidden /> Conexão com {avisosBancos.length === 1 ? "um banco precisa" : "bancos precisa"}{" "}
            de atenção
          </p>
          <ul className="mt-1 list-disc pl-5">
            {avisosBancos.map((a) => (
              <li key={a.pluggy_item_id}>
                {a.banco ?? "Banco"} ({nomeDono(a.dono_membro_id)}): {a.texto}
              </li>
            ))}
          </ul>
          <details className="mt-1">
            <summary className="cursor-pointer font-medium">Como renovar</summary>
            <p className="mt-1">{COMO_RENOVAR}</p>
          </details>
        </div>
      )}
      <Erro mensagem={erro} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        {semNada && (
          <div className="lg:col-span-2">
            <Vazio
              titulo="Vamos começar?"
              texto="Cadastre seu salário e as contas fixas em Lançamentos → Recorrentes. O painel se monta sozinho."
              acao={
                <Link href="/lancamentos" className="text-sm font-medium text-marca-600 dark:text-marca-400">
                  Ir para Lançamentos
                </Link>
              }
            />
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-4">
          <Cartao>
            <Titulo>Vencimentos</Titulo>
            {venc.atrasados.length > 0 && (
              <div className="mb-3 rounded-2xl bg-red-50 p-2 dark:bg-red-950/40">
                <p className="flex items-center gap-1 px-1 text-sm font-semibold text-red-700 dark:text-red-300">
                  <AlertTriangle className="size-4" aria-hidden /> Atrasados ({venc.atrasados.length})
                </p>
                <ul className="divide-y divide-red-100 dark:divide-red-900/50">
                  {venc.atrasados.map((o) => (
                    <LinhaOcorrencia key={o.id} o={o} aoAbrir={() => setAberta(o)} aoPagar={() => setPagando(o)} />
                  ))}
                </ul>
              </div>
            )}
            {venc.proximos.length === 0 ? (
              <p className="text-sm text-slate-500">Nada vencendo nos próximos 15 dias.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {venc.proximos.map((o) => (
                  <LinhaOcorrencia key={o.id} o={o} aoAbrir={() => setAberta(o)} aoPagar={() => setPagando(o)} />
                ))}
              </ul>
            )}
          </Cartao>

          {rel.avisos.length > 0 && <CartaoAvisos avisos={rel.avisos.slice(0, 3)} total={rel.avisos.length} />}

          <CartaoRitmo ritmo={ritmo} mes={mes} hoje={hoje} previsto={sobra.previsto.saidas} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <CartaoCategorias ocorrencias={ocorrencias} gastos={gastos} mes={mes} />

          {progresso.length > 0 && (
            <Cartao>
              <Titulo>Progresso</Titulo>
              <ul className="flex flex-col gap-4">
                {progresso.map((p) => (
                  <li key={p.id}>
                    <Link href={p.href} className="block">
                      <div className="mb-1.5 flex justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{p.nome}</span>
                        <span className="shrink-0 text-xs text-slate-500">
                          <span className="valor-oculto">{formatarReais(p.pago)}</span> de{" "}
                          <span className="valor-oculto">{formatarReais(p.total)}</span>
                        </span>
                      </div>
                      <Barra valor={p.pago} total={p.total} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </div>

        <Cartao className="lg:col-span-2">
          <Titulo>Projeção (12 meses)</Titulo>
          <GraficoProjecao dados={proj} />
          {proj.some((p) => p.sobra < 0) && (
            <p className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="size-3.5" aria-hidden /> Meses em vermelho fecham no negativo.
            </p>
          )}
          {saldoHoje?.automatico && (
            <p className="mt-1 text-xs text-slate-500">
              Saldo acumulado a partir do saldo das contas conectadas (<span className="valor-oculto">{formatarReais(saldoHoje.valor)}</span>).
            </p>
          )}
          {!saldoHoje && (
            <p className="mt-1 text-xs text-slate-500">
              Dica: informe o saldo em conta em{" "}
              <Link href="/configuracoes" className="underline">
                Configurações
              </Link>{" "}
              para ver o saldo acumulado.
            </p>
          )}
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-xs text-slate-500">Ver em tabela</summary>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="font-medium">Mês</th>
                    <th className="text-right font-medium">Sobra</th>
                    {proj[0]?.acumulado !== null && <th className="text-right font-medium">Saldo acumulado</th>}
                  </tr>
                </thead>
                <tbody>
                  {proj.map((p) => (
                    <tr key={p.mes} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1 first-letter:uppercase">{nomeMesCurto(p.mes)}</td>
                      <td className="text-right">
                        <Dinheiro valor={p.sobra} sinal />
                      </td>
                      {p.acumulado !== null && (
                        <td className="text-right">
                          <Dinheiro valor={p.acumulado} sinal />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Cartao>
      </div>

      <ModalOcorrencia o={aberta} aoFechar={() => setAberta(null)} aoPagar={setPagando} />
      <ModalPagar o={pagando} aoFechar={() => setPagando(null)} />
    </>
  );
}

function Atalho({ href, Icone, children }: { href: string; Icone: typeof Inbox; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-white/12 py-1 pr-3.5 pl-1.5 text-sm font-medium whitespace-nowrap text-white ring-1 ring-white/15 hover:bg-white/20"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-white/15">
        <Icone className="size-4" aria-hidden />
      </span>
      {children}
    </Link>
  );
}

/** Topo do Painel: total guardado em destaque e o mês em três números. */
function FaixaDestaque({
  guardado,
  entradas,
  recebido,
  saidas,
  pago,
  sobra,
  atalhos,
}: {
  guardado: ReturnType<typeof resumoGuardado>;
  entradas: number;
  recebido: number;
  saidas: number;
  pago: number;
  sobra: number;
  atalhos: React.ReactNode;
}) {
  const ocultar = useOcultar();
  const blocos = [
    { rotulo: "Entradas", Icone: ArrowDownLeft, valor: entradas, sub: `recebido ${formatarReais(recebido)}` },
    { rotulo: "Saídas", Icone: ArrowUpRight, valor: saidas, sub: `pago ${formatarReais(pago)}` },
    { rotulo: "Sobra prevista", Icone: Wallet, valor: sobra, sub: entradas > 0 ? `${Math.round((sobra / entradas) * 100)}% das entradas` : "" },
  ];
  return (
    <section
      aria-label="Resumo"
      className="faixa-destaque -mx-4 -mt-[max(0.75rem,env(safe-area-inset-top))] rounded-b-[2rem] px-4 pt-[calc(max(0.75rem,env(safe-area-inset-top))+0.75rem)] pb-5 text-white shadow-[0_20px_50px_-20px_rgba(29,72,216,.6)] lg:mx-0 lg:mt-0 lg:rounded-[2rem] lg:px-8 lg:pt-6 lg:pb-7"
    >
      <div className="flex items-center justify-between gap-2">
        <SeletorVisaoFaixa />
        <button
          type="button"
          onClick={alternarOcultar}
          aria-label={ocultar ? "Mostrar valores" : "Esconder valores"}
          aria-pressed={ocultar}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 hover:bg-white/20"
        >
          {ocultar ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <Link href="/reservas" className="max-w-full min-w-0">
          <p className="text-sm text-white/75">Total guardado</p>
          <p className="valor-oculto numero-grande truncate text-[2.5rem] leading-tight font-bold lg:text-5xl">{formatarReais(guardado.total)}</p>
          <p className="mt-0.5 truncate text-xs text-white/70">
            em conta <span className="valor-oculto">{formatarReais(guardado.totalConta)}</span> · reservas{" "}
            <span className="valor-oculto">{formatarReais(guardado.totalReservas)}</span>
          </p>
        </Link>
        <SeletorMes naFaixa />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 lg:gap-3">
        {blocos.map(({ rotulo, Icone, valor, sub }) => (
          <div key={rotulo} className="min-w-0 rounded-2xl bg-white/10 p-2.5 ring-1 ring-white/15 backdrop-blur-sm lg:p-3.5">
            <p className="flex items-center gap-1.5 text-xs text-white/80">
              <span className="hidden size-5 shrink-0 items-center justify-center rounded-md bg-white/15 min-[400px]:flex">
                <Icone className="size-3.5" aria-hidden />
              </span>
              <span className="truncate">{rotulo}</span>
            </p>
            <p className="valor-oculto mt-1 truncate text-sm font-bold tabular-nums min-[400px]:text-base lg:text-xl">{formatarReais(valor)}</p>
            {sub && <p className="valor-oculto truncate text-[10px] text-white/65 lg:text-xs">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">{atalhos}</div>
    </section>
  );
}

/** Gastos (ou entradas) do mês por categoria: rosca + lista com barras. */
function CartaoCategorias({ ocorrencias, gastos, mes }: { ocorrencias: Ocorrencia[]; gastos: Gasto[]; mes: string }) {
  const { categorias } = useApp();
  const [tipo, setTipo] = useState<"saida" | "entrada">("saida");
  const [sel, setSel] = useState<string | null>(null);
  const mapa = new Map<string | null, number>();
  if (tipo === "saida") {
    for (const g of gastos) if (g.mes === mes) mapa.set(g.categoria_id, (mapa.get(g.categoria_id) ?? 0) + g.valor);
  } else {
    for (const o of ocorrencias)
      if (o.tipo === "entrada" && o.status !== "cancelado" && mesDe(o.vencimento) === mes)
        mapa.set(o.categoria_id, (mapa.get(o.categoria_id) ?? 0) + valorConta(o));
  }
  const linhas = [...mapa.entries()]
    .filter(([, v]) => v > 0)
    .map(([id, valor]) => ({ id: id ?? "sem", cat: categorias.find((c) => c.id === id), valor }))
    .sort((a, b) => b.valor - a.valor);
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const fatias = linhas.map((l) => ({ id: l.id, nome: l.cat?.nome ?? "Sem categoria", valor: l.valor, cor: l.cat?.cor ?? "#94a3b8" }));
  return (
    <Cartao>
      <div className="mb-4 flex justify-center">
        <div role="tablist" className="flex gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              ["saida", "Gastos", "bg-red-500"],
              ["entrada", "Entradas", "bg-emerald-500"],
            ] as const
          ).map(([v, r, cor]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={tipo === v}
              onClick={() => {
                setTipo(v);
                setSel(null);
              }}
              className={clsx(
                "flex min-h-9 items-center gap-2 rounded-xl px-4 text-sm font-semibold",
                tipo === v ? "bg-white shadow-sm dark:bg-slate-950" : "text-slate-500",
              )}
            >
              <span className={clsx("size-2 rounded-full", cor)} aria-hidden />
              {r}
            </button>
          ))}
        </div>
      </div>
      {linhas.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{tipo === "saida" ? "Nenhum gasto neste mês." : "Nenhuma entrada neste mês."}</p>
      ) : (
        <>
          <Rosca fatias={fatias} total={total} rotulo={tipo === "saida" ? "Gastos do mês" : "Entradas do mês"} selecionada={sel} aoSelecionar={setSel} />
          <ul className="mt-5 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {linhas.map((l) => {
              const limite = tipo === "saida" ? l.cat?.limite_mensal : null;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSel(sel === l.id ? null : l.id)}
                    className={clsx("flex w-full items-center gap-3 py-2.5 text-left", sel && sel !== l.id && "opacity-50")}
                  >
                    <IconeCategoria categoria={l.cat} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{l.cat?.nome ?? "Sem categoria"}</span>
                        <Dinheiro valor={l.valor} className="text-sm font-bold" />
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${Math.min(100, limite ? (l.valor / limite) * 100 : (l.valor / total) * 100)}%`,
                              background: limite && l.valor > limite ? "#dc2626" : (l.cat?.cor ?? "#94a3b8"),
                            }}
                          />
                        </span>
                        <span className="w-24 shrink-0 text-right text-[11px] text-slate-500">
                          {limite ? (
                            <>
                              de <span className="valor-oculto">{formatarReais(limite)}</span>
                            </>
                          ) : (
                            `${Math.round((l.valor / total) * 100)}%`
                          )}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {tipo === "saida" && gastos.some((g) => g.mes === mes && g.origem === "cartao") && (
            <p className="mt-2 text-xs text-slate-500">As faturas dos cartões conectados aparecem abertas nas categorias das compras.</p>
          )}
        </>
      )}
    </Cartao>
  );
}

/** Ritmo de gastos: acumulado do mês contra o mês anterior até o mesmo dia. */
function CartaoRitmo({ ritmo, mes, hoje, previsto }: { ritmo: Ritmo; mes: string; hoje: string; previsto: number }) {
  const cores = useCoresGrafico();
  const [modo, setModo] = useState<"acumulado" | "diario">("acumulado");
  if (mes > mesDe(hoje)) return null;
  const mesAnt = somarMeses(mes, -1);
  const curto = (m: string) => nomeMesCurto(m).slice(0, 3);
  const v = ritmo.variacao;
  return (
    <Cartao>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">Ritmo de gastos</h2>
        {v !== null && (
          <span
            className={clsx(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              v > 0.05
                ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
            )}
          >
            {v > 0 ? "+" : ""}
            {Math.round(v * 100)}% vs 1–{ritmo.dia} {curto(mesAnt)}
          </span>
        )}
      </div>
      <Abas
        abas={[
          { valor: "acumulado", rotulo: "Acumulado" },
          { valor: "diario", rotulo: "Por dia" },
        ]}
        atual={modo}
        aoMudar={setModo}
      />
      {modo === "acumulado" ? (
        <>
          <div className="mb-1 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: cores.positivo }} aria-hidden /> {curto(mes)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed" style={{ borderColor: cores.textoSecundario }} aria-hidden /> {curto(mesAnt)}
            </span>
          </div>
          <CurvaRitmo atual={ritmo.atual} anterior={ritmo.anterior} nomeAtual={curto(mes)} nomeAnterior={curto(mesAnt)} cor={cores.positivo} />
        </>
      ) : (
        <BarrasDiarias valores={ritmo.diario} media={ritmo.mediaDia} cor={cores.positivo} />
      )}
      <dl className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
        <div className="flex justify-between gap-2 py-2">
          <dt className="text-slate-500">Gasto até {ritmo.dia ? `o dia ${ritmo.dia}` : "agora"}</dt>
          <dd>
            <Dinheiro valor={ritmo.totalAteHoje} className="font-semibold" />
          </dd>
        </div>
        <div className="flex justify-between gap-2 py-2">
          <dt className="text-slate-500">Média por dia</dt>
          <dd>
            <Dinheiro valor={ritmo.mediaDia} className="font-semibold" />
          </dd>
        </div>
        <div className="flex justify-between gap-2 py-2">
          <dt className="text-slate-500">Saídas previstas no mês</dt>
          <dd>
            <Dinheiro valor={previsto} className="font-semibold text-marca-600 dark:text-marca-400" />
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-[11px] text-slate-500">Compras do cartão pela data da compra; as outras saídas pela data do pagamento.</p>
    </Cartao>
  );
}

/** "Vale sua atenção": os primeiros avisos do mês. */
function CartaoAvisos({ avisos, total }: { avisos: Aviso[]; total: number }) {
  return (
    <Cartao>
      <Titulo
        acao={
          <Link href="/analises" className="flex items-center text-sm font-medium text-marca-600 dark:text-marca-400">
            {total > avisos.length ? `Ver todos (${total})` : "Análises"} <ChevronRight className="size-4" aria-hidden />
          </Link>
        }
      >
        Vale sua atenção
      </Titulo>
      <ListaAvisos avisos={avisos} />
    </Cartao>
  );
}

function GraficoProjecao({ dados }: { dados: MesProjecao[] }) {
  const cores = useCoresGrafico();
  const comAcumulado = dados[0]?.acumulado !== null;
  // Rótulos curtos: "nov", "dez", "jan/27" (o ano só aparece em janeiro e no primeiro mês).
  const linhas = dados.map((d, i) => ({ ...d, rotulo: i === 0 || d.mes.endsWith("-01") ? nomeMesCurto(d.mes) : nomeMesCurto(d.mes).slice(0, 3) }));
  return (
    <div className="h-56 lg:h-72" role="img" aria-label="Gráfico da sobra prevista nos próximos 12 meses">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={linhas} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={cores.grade} vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="rotulo"
            tick={{ fill: cores.textoSecundario, fontSize: 11 }}
            stroke={cores.grade}
            interval="preserveStartEnd"
            minTickGap={6}
            tickMargin={4}
            tickLine={false}
          />
          <YAxis tickFormatter={reaisCurto} tick={{ fill: cores.textoSecundario, fontSize: 11 }} stroke="transparent" width={60} />
          <ReferenceLine y={0} stroke={cores.textoSecundario} />
          <Tooltip
            formatter={(v, nome) => [formatarReais(Number(v)), nome === "acumulado" ? "Saldo acumulado" : "Sobra"]}
            contentStyle={{ background: cores.superficie, borderColor: cores.grade, borderRadius: 12, color: cores.texto }}
            cursor={{ fill: cores.grade, opacity: 0.4 }}
          />
          <Bar dataKey="sobra" name="Sobra" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {linhas.map((d) => (
              <Cell key={d.mes} fill={d.sobra < 0 ? cores.negativo : cores.positivo} />
            ))}
          </Bar>
          {comAcumulado && (
            <Line type="monotone" dataKey="acumulado" name="Saldo acumulado" stroke={cores.texto} strokeWidth={2} dot={{ r: 4 }} />
          )}
          {comAcumulado && (
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: cores.textoSecundario }}>{v}</span>} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
