"use client";

import { AlertTriangle, ChevronRight, Inbox } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { daVisao, useApp, useCarregar } from "@/components/app-contexto";
import { Cabecalho, SeletorMes } from "@/components/cabecalho";
import { LinhaOcorrencia, ModalOcorrencia, ModalPagar } from "@/components/ocorrencias";
import { Barra, Cartao, Carregando, Dinheiro, Erro, Titulo, Vazio } from "@/components/ui";
import { resumoContrato, resumoDivida } from "@/lib/compromissos";
import { hojeISO, nomeMesCurto } from "@/lib/datas";
import { buscarTodos } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { reaisCurto, useCoresGrafico } from "@/lib/graficos";
import { gastosPorCategoria, projecao, saldoEmConta, sobraDoMes, vencimentos, type MesProjecao } from "@/lib/painel";
import type { ContaExterna } from "@/lib/caixa-entrada";
import { gastosDaFatura, type CompraCartao } from "@/lib/pluggy/cartao";
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
    const [
      ocorrencias,
      contratos,
      dividas,
      projetos,
      itens,
      reservas,
      saldos,
      racha,
      contasExternas,
      aRevisar,
      comprasCartao,
      itensBancos,
    ] = await Promise.all([
      buscarTodos<Ocorrencia>("ocorrencias", casa.id, undefined, "vencimento"),
      buscarTodos<Contrato>("contratos", casa.id),
      buscarTodos<Divida>("dividas", casa.id),
      buscarTodos<Projeto>("projetos", casa.id, (q) => q.eq("status", "ativo")),
      buscarTodos<ProjetoItem>("projeto_itens", casa.id),
      buscarTodos<Reserva>("reservas", casa.id),
      buscarTodos<ReservaSaldo>("reserva_saldos", casa.id),
      casa.racha_ativo ? buscarTodos<RachaMovimento>("racha_movimentos", casa.id) : Promise.resolve([]),
      buscarTodos<ContaExterna>("contas_externas", casa.id),
      buscarTodos<{ conta_externa_id: string }>("transacoes_externas", casa.id, (q) => q.eq("situacao", "pendente"), "data"),
      buscarTodos<CompraCartao & { conta_externa_id: string }>("transacoes_externas", casa.id, (q) => q.eq("situacao", "cartao"), "data"),
      buscarTodos<EstadoItem>("pluggy_itens", casa.id),
    ]);
    // Caixa de entrada: só contas correntes ativas.
    const bancosAtivos = new Set(contasExternas.filter((c) => c.ativa && c.tipo === "BANK").map((c) => c.id));
    const pendentesCaixa = aRevisar.filter((t) => bancosAtivos.has(t.conta_externa_id)).length;
    return {
      ocorrencias,
      contratos,
      dividas,
      projetos,
      itens,
      reservas,
      saldos,
      racha,
      contasExternas,
      pendentesCaixa,
      comprasCartao,
      itensBancos,
    };
  });

  if (carregando && !dados)
    return (
      <>
        <Cabecalho titulo="Painel" />
        <Carregando />
      </>
    );
  if (!dados)
    return (
      <>
        <Cabecalho titulo="Painel" />
        <Erro mensagem={erro} />
      </>
    );

  const ocorrencias = daVisao(dados.ocorrencias, visao);
  const semNada = dados.ocorrencias.length === 0;
  const sobra = sobraDoMes(ocorrencias, mes);
  const saldoHoje = saldoEmConta(
    dados.contasExternas,
    visao,
    casa.saldo_conta !== null && casa.saldo_conta_data ? { valor: casa.saldo_conta, data: casa.saldo_conta_data } : null,
  );
  const proj = projecao(ocorrencias, hoje, saldoHoje);
  const venc = vencimentos(ocorrencias, hoje);
  const avisosBancos = avisosConexao(dados.itensBancos, hoje);
  // Compras dos cartões vinculados na fatura do mês (dono do cartão conforme a visão).
  const contasCartao = new Map(
    dados.contasExternas.filter((c) => c.tipo === "CREDIT" && c.ativa && c.cartao_id).map((c) => [c.id, c.dono_membro_id]),
  );
  const gastosCartao = gastosDaFatura(
    dados.comprasCartao.filter(
      (x) => contasCartao.has(x.conta_externa_id) && (visao === "casal" || contasCartao.get(x.conta_externa_id) === visao),
    ),
    mes,
  );
  const gastos = gastosPorCategoria(ocorrencias, mes);
  const maiorGasto = gastos[0]?.total ?? 0;

  const progresso = [
    ...daVisao(dados.contratos, visao).map((c) => {
      const r = resumoContrato(c, dados.ocorrencias);
      return {
        id: c.id,
        nome: c.nome,
        pago: r.totalPago,
        total: c.valor_total,
        href: `/compromissos/parcelado/${c.id}`,
        ativo: r.restantes > 0,
      };
    }),
    ...daVisao(dados.dividas, visao).map((d) => {
      const r = resumoDivida(d, dados.ocorrencias);
      return { id: d.id, nome: d.descricao, pago: r.pago, total: d.valor_total, href: `/compromissos/divida/${d.id}`, ativo: !r.quitada };
    }),
    ...daVisao(dados.projetos, visao).map((p) => {
      const r = resumoProjeto(
        dados.itens.filter((i) => i.projeto_id === p.id),
        dados.ocorrencias.filter((o) => o.origem_tipo === "parcela_projeto"),
      );
      return { id: p.id, nome: p.nome, pago: r.pago, total: r.contratado, href: `/projetos/${p.id}`, ativo: true };
    }),
  ].filter((p) => p.ativo);

  const guardado = resumoGuardado(dados.reservas, dados.saldos, dados.contasExternas, visao);
  // Total guardado e caixa do racha: no celular ficam no fim; no computador, embaixo da sobra.
  const rodape = (
    <>
      <Link href="/reservas" className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="text-xs text-slate-500">Total guardado</p>
        <Dinheiro valor={guardado.total} className="font-semibold" />
        <p className="text-[11px] text-slate-500">
          em conta {formatarReais(guardado.totalConta)} · reservas {formatarReais(guardado.totalReservas)}
        </p>
      </Link>
      {casa.racha_ativo ? (
        <Link href="/racha" className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-xs text-slate-500">Caixa do racha</p>
          <Dinheiro valor={saldoRacha(dados.racha)} sinal className="font-semibold" />
        </Link>
      ) : (
        <div />
      )}
    </>
  );

  return (
    <>
      <Cabecalho titulo="Painel" />
      <SeletorMes />
      {avisosBancos.length > 0 && (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
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
      {dados.pendentesCaixa > 0 && (
        <Link
          href="/caixa"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/40"
        >
          <Inbox className="size-5 text-emerald-600" aria-hidden />
          <span className="flex-1">
            <strong>{dados.pendentesCaixa}</strong> {dados.pendentesCaixa === 1 ? "transação" : "transações"} dos bancos para revisar na
            caixa de entrada
          </span>
          <ChevronRight className="size-4 text-slate-400" aria-hidden />
        </Link>
      )}
      <Erro mensagem={erro} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        {semNada && (
          <div className="lg:col-span-2">
            <Vazio
              titulo="Vamos começar?"
              texto="Cadastre seu salário e as contas fixas em Lançamentos → Recorrentes. O painel se monta sozinho."
              acao={
                <Link href="/lancamentos" className="text-sm font-medium text-emerald-600">
                  Ir para Lançamentos
                </Link>
              }
            />
          </div>
        )}

        {/* 1. Sobra do mês */}
        <div className="order-1 flex min-w-0 flex-col gap-4">
          <Cartao>
            <Titulo>Sobra do mês</Titulo>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm text-slate-500">Sobra prevista</span>
              <Dinheiro valor={sobra.previsto.saldo} sinal className="text-2xl font-bold" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {(
                [
                  ["Entradas", sobra.previsto.entradas, sobra.realizado.entradas, "recebido", "bg-emerald-500"],
                  ["Saídas", sobra.previsto.saidas, sobra.realizado.saidas, "pago", "bg-red-500"],
                ] as const
              ).map(([rotulo, previsto, realizado, verbo, cor]) => (
                <div key={rotulo} className="min-w-0 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">{rotulo}</p>
                  <Dinheiro valor={previsto} className="block truncate font-semibold" />
                  <Barra valor={realizado} total={previsto} cor={cor} />
                  <p className="mt-1 truncate text-[11px] text-slate-500">
                    {verbo} {formatarReais(realizado)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Realizado até agora: <Dinheiro valor={sobra.realizado.saldo} sinal className="font-medium" />
            </p>
          </Cartao>

          {/* 6. Total guardado e racha (no computador, embaixo da sobra) */}
          <div className="hidden grid-cols-2 gap-3 text-center text-sm lg:grid">{rodape}</div>
        </div>

        {/* 2. Projeção */}
        <Cartao className="order-3 lg:col-span-2">
          <Titulo>Projeção (12 meses)</Titulo>
          <GraficoProjecao dados={proj} />
          {proj.some((p) => p.sobra < 0) && (
            <p className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="size-3.5" aria-hidden /> Meses em vermelho fecham no negativo.
            </p>
          )}
          {saldoHoje?.automatico && (
            <p className="mt-1 text-xs text-slate-500">
              Saldo acumulado a partir do saldo das contas conectadas ({formatarReais(saldoHoje.valor)}).
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

        {/* 3. Vencimentos */}
        <Cartao className="order-2">
          <Titulo>Vencimentos</Titulo>
          {venc.atrasados.length > 0 && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950/40">
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

        {/* 4. Progresso */}
        {progresso.length > 0 && (
          <Cartao className="order-4">
            <Titulo>Progresso</Titulo>
            <ul className="flex flex-col gap-3">
              {progresso.map((p) => (
                <li key={p.id}>
                  <Link href={p.href} className="block">
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{p.nome}</span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {formatarReais(p.pago)} de {formatarReais(p.total)}
                      </span>
                    </div>
                    <Barra valor={p.pago} total={p.total} />
                  </Link>
                </li>
              ))}
            </ul>
          </Cartao>
        )}

        {/* 5. Gastos por categoria */}
        <Cartao className="order-5">
          <Titulo>Gastos por categoria</Titulo>
          {gastos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma saída neste mês.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {gastos.map((g) => {
                const cat = categorias.find((c) => c.id === g.categoria_id);
                return (
                  <li key={g.categoria_id ?? "sem"}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: cat?.cor ?? "#94a3b8" }} aria-hidden />
                        {cat?.nome ?? "Sem categoria"}
                      </span>
                      <span className="tabular-nums">
                        {formatarReais(g.total)}{" "}
                        <span className="text-xs text-slate-500">({Math.round((g.total / sobra.previsto.saidas) * 100)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(g.total / maiorGasto) * 100}%`, background: cat?.cor ?? "#94a3b8" }}
                      />
                    </div>
                    {cat?.nome === "Cartão" && gastosCartao.length > 0 && (
                      <details className="mt-1 ml-4 text-xs">
                        <summary className="cursor-pointer text-slate-500">Ver compras da fatura por categoria</summary>
                        <ul className="mt-1 flex flex-col gap-1">
                          {gastosCartao.map((s) => {
                            const sub = categorias.find((c) => c.id === s.categoria_id);
                            return (
                              <li key={s.categoria_id ?? "sem"}>
                                <div className="flex justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full" style={{ background: sub?.cor ?? "#94a3b8" }} aria-hidden />
                                    {sub?.nome ?? "Sem categoria"}
                                  </span>
                                  <span className="tabular-nums">{formatarReais(s.total)}</span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${(s.total / gastosCartao[0].total) * 100}%`, background: sub?.cor ?? "#94a3b8" }}
                                  />
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>

        {/* 6. Rodapé (no celular, no fim da tela) */}
        <div className="order-6 grid grid-cols-2 gap-3 text-center text-sm lg:hidden">{rodape}</div>
      </div>

      <ModalOcorrencia o={aberta} aoFechar={() => setAberta(null)} aoPagar={setPagando} />
      <ModalPagar o={pagando} aoFechar={() => setPagando(null)} />
    </>
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
          <CartesianGrid stroke={cores.grade} vertical={false} />
          <XAxis
            dataKey="rotulo"
            tick={{ fill: cores.textoSecundario, fontSize: 11 }}
            stroke={cores.grade}
            interval="preserveStartEnd"
            minTickGap={6}
            tickMargin={4}
          />
          <YAxis tickFormatter={reaisCurto} tick={{ fill: cores.textoSecundario, fontSize: 11 }} stroke={cores.grade} width={60} />
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
