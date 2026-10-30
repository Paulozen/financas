"use client";

import { AlertTriangle } from "lucide-react";
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
import { gastosPorCategoria, projecao, sobraDoMes, vencimentos, type MesProjecao } from "@/lib/painel";
import { resumoProjeto } from "@/lib/projetos";
import { saldoRacha } from "@/lib/racha";
import { totalGuardado } from "@/lib/reservas";
import type { Contrato, Divida, Ocorrencia, Projeto, ProjetoItem, RachaMovimento, Reserva, ReservaSaldo } from "@/lib/tipos";

export default function Painel() {
  const { casa, mes, visao, categorias } = useApp();
  const [aberta, setAberta] = useState<Ocorrencia | null>(null);
  const [pagando, setPagando] = useState<Ocorrencia | null>(null);
  const hoje = hojeISO();

  const { dados, erro, carregando } = useCarregar("painel", async () => {
    const [ocorrencias, contratos, dividas, projetos, itens, reservas, saldos, racha] = await Promise.all([
      buscarTodos<Ocorrencia>("ocorrencias", casa.id, undefined, "vencimento"),
      buscarTodos<Contrato>("contratos", casa.id),
      buscarTodos<Divida>("dividas", casa.id),
      buscarTodos<Projeto>("projetos", casa.id, (q) => q.eq("status", "ativo")),
      buscarTodos<ProjetoItem>("projeto_itens", casa.id),
      buscarTodos<Reserva>("reservas", casa.id),
      buscarTodos<ReservaSaldo>("reserva_saldos", casa.id),
      casa.racha_ativo ? buscarTodos<RachaMovimento>("racha_movimentos", casa.id) : Promise.resolve([]),
    ]);
    return { ocorrencias, contratos, dividas, projetos, itens, reservas, saldos, racha };
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
  const proj = projecao(
    ocorrencias,
    hoje,
    casa.saldo_conta !== null && casa.saldo_conta_data ? { valor: casa.saldo_conta, data: casa.saldo_conta_data } : null,
  );
  const venc = vencimentos(ocorrencias, hoje);
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

  // Total guardado e caixa do racha: no celular ficam no fim; no computador, embaixo da sobra.
  const rodape = (
    <>
      <Link href="/reservas" className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="text-xs text-slate-500">Total guardado</p>
        <Dinheiro valor={totalGuardado(daVisao(dados.reservas, visao), dados.saldos)} className="font-semibold" />
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
      <Erro mensagem={erro} />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
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
        <div className="flex flex-col gap-4 lg:order-1">
          <Cartao>
            <Titulo>Sobra do mês</Titulo>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="font-medium" />
                  <th className="text-right font-medium">Entradas</th>
                  <th className="text-right font-medium">Saídas</th>
                  <th className="text-right font-medium">Sobra</th>
                </tr>
              </thead>
              <tbody>
                {(["previsto", "realizado"] as const).map((k) => (
                  <tr key={k}>
                    <th scope="row" className="py-1 text-left font-medium capitalize">
                      {k}
                    </th>
                    <td className="text-right">
                      <Dinheiro valor={sobra[k].entradas} />
                    </td>
                    <td className="text-right">
                      <Dinheiro valor={sobra[k].saidas} />
                    </td>
                    <td className="text-right">
                      <Dinheiro valor={sobra[k].saldo} sinal className={k === "previsto" ? "text-base font-bold" : "font-semibold"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>

          {/* 6. Total guardado e racha (no computador, embaixo da sobra) */}
          <div className="hidden grid-cols-2 gap-3 text-center text-sm lg:grid">{rodape}</div>
        </div>

        {/* 2. Projeção */}
        <Cartao className="lg:order-3 lg:col-span-2">
          <Titulo>Projeção (12 meses)</Titulo>
          <GraficoProjecao dados={proj} />
          {proj.some((p) => p.sobra < 0) && (
            <p className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="size-3.5" aria-hidden /> Meses em vermelho fecham no negativo.
            </p>
          )}
          {casa.saldo_conta === null && (
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
          </details>
        </Cartao>

        {/* 3. Vencimentos */}
        <Cartao className="lg:order-2 lg:row-span-1">
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
          <Cartao className="lg:order-4">
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
        <Cartao className="lg:order-5">
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
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>

        {/* 6. Rodapé (no celular, no fim da tela) */}
        <div className="grid grid-cols-2 gap-3 text-center text-sm lg:hidden">{rodape}</div>
      </div>

      <ModalOcorrencia o={aberta} aoFechar={() => setAberta(null)} aoPagar={setPagando} />
      <ModalPagar o={pagando} aoFechar={() => setPagando(null)} />
    </>
  );
}

function GraficoProjecao({ dados }: { dados: MesProjecao[] }) {
  const cores = useCoresGrafico();
  const comAcumulado = dados[0]?.acumulado !== null;
  const linhas = dados.map((d) => ({ ...d, rotulo: nomeMesCurto(d.mes) }));
  return (
    <div className="h-56 lg:h-72" role="img" aria-label="Gráfico da sobra prevista nos próximos 12 meses">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={linhas} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={cores.grade} vertical={false} />
          <XAxis
            dataKey="rotulo"
            tick={{ fill: cores.textoSecundario, fontSize: 10 }}
            stroke={cores.grade}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={40}
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
