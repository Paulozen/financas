"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { daVisao, useApp, useCarregar } from "@/components/app-contexto";
import { Cabecalho } from "@/components/cabecalho";
import { SeletorDono } from "@/components/ocorrencias";
import {
  AreaTexto,
  Botao,
  Campo,
  CampoValor,
  Cartao,
  Carregando,
  Dinheiro,
  Erro,
  formatarErro,
  Interruptor,
  Modal,
  Selo,
  Titulo,
  Vazio,
} from "@/components/ui";
import { resumoContrato, resumoDivida } from "@/lib/compromissos";
import { formatarData, formatarDiaMes, hojeISO, nomeMesCurto } from "@/lib/datas";
import { buscarTodos, checar } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { reaisCurto, useCoresGrafico } from "@/lib/graficos";
import { contaNoTotal } from "@/lib/pluggy/grupos";
import { resumoMeta, ROTULO_SITUACAO, type SituacaoMeta } from "@/lib/metas";
import { resumoGuardado, saldoAtual, serieGuardado, serieReservas, type ContaGuardada } from "@/lib/reservas";
import { assumirGrupo, moverAplicacao } from "@/lib/reservas-auto";
import { supabase } from "@/lib/supabase";
import type { Contrato, Divida, Ocorrencia, Reserva, ReservaSaldo } from "@/lib/tipos";

export default function Reservas() {
  const { casa, visao, nomeDono } = useApp();
  const [form, setForm] = useState<Reserva | "nova" | null>(null);
  const [atualizando, setAtualizando] = useState<Reserva | null>(null);
  const [historico, setHistorico] = useState<Reserva | null>(null);
  const { dados, erro, carregando, recarregar } = useCarregar("reservas", async () => {
    const [reservas, saldos, investimentos, contas, contaSaldos, contratos, dividas, ocorrencias] = await Promise.all([
      buscarTodos<Reserva>("reservas", casa.id, undefined, "nome"),
      buscarTodos<ReservaSaldo>("reserva_saldos", casa.id, undefined, "data"),
      buscarTodos<Investimento>("investimentos_externos", casa.id, undefined, "nome"),
      buscarTodos<ContaGuardada>("contas_externas", casa.id, undefined, "nome"),
      buscarTodos<{ conta_externa_id: string; data: string; valor: number }>("conta_saldos", casa.id, undefined, "data"),
      buscarTodos<Contrato>("contratos", casa.id),
      buscarTodos<Divida>("dividas", casa.id),
      buscarTodos<Ocorrencia>("ocorrencias", casa.id, (q) => q.in("origem_tipo", ["parcela_contrato", "pagamento_divida", "meta_divida"])),
    ]);
    return { reservas, saldos, investimentos, contas, contaSaldos, contratos, dividas, ocorrencias };
  });
  const reservas = daVisao(dados?.reservas ?? [], visao);
  const saldos = dados?.saldos ?? [];
  const ativas = reservas.filter((r) => r.ativa);
  const guardado = resumoGuardado(dados?.reservas ?? [], saldos, dados?.contas ?? [], visao);
  const hoje = hojeISO();
  // Aplicações que contam no total, por reserva (as resgatadas e zeradas não aparecem).
  const aplicacoesDe = (reservaId: string) =>
    (dados?.investimentos ?? []).filter((i) => i.reserva_id === reservaId && contaNoTotal({ ...i, saldo: Number(i.saldo) }, hoje));
  // Patrimônio: total guardado menos o que falta pagar dos parcelados e dívidas cadastrados.
  const devendo =
    daVisao(dados?.contratos ?? [], visao).reduce((s, c) => s + resumoContrato(c, dados?.ocorrencias ?? []).saldoDevedor, 0) +
    daVisao(dados?.dividas ?? [], visao).reduce((s, d) => s + resumoDivida(d, dados?.ocorrencias ?? []).restante, 0);
  const contasDaVisao = guardado.emConta.map((c) => c.id);
  const evolucao = serieGuardado(ativas, saldos, dados?.contaSaldos ?? [], contasDaVisao);

  return (
    <>
      <Cabecalho titulo="Reservas" />
      <Erro mensagem={erro} />
      {carregando && !dados ? (
        <Carregando />
      ) : (
        <>
          <div className="lg:grid lg:grid-cols-[18rem_1fr] lg:items-start lg:gap-4">
            <Cartao className="mb-4 text-center lg:py-8">
              <p className="text-sm text-slate-500">Total guardado</p>
              <Dinheiro valor={guardado.total} className="numero-grande text-3xl font-bold" />
              <p className="mt-1 text-xs text-slate-500">Não entra na sobra do mês nem na projeção.</p>
              {devendo > 0 && (
                <dl className="mt-3 rounded-2xl bg-slate-50 p-3 text-left text-sm dark:bg-slate-800/60">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Falta pagar (parcelados e dívidas)</dt>
                    <dd>
                      <Dinheiro valor={-devendo} sinal />
                    </dd>
                  </div>
                  <div className="mt-1 flex justify-between gap-2 font-semibold">
                    <dt>Patrimônio líquido</dt>
                    <dd>
                      <Dinheiro valor={guardado.total - devendo} sinal />
                    </dd>
                  </div>
                </dl>
              )}
              <div className="mt-3 flex flex-col gap-2 text-left text-sm">
                {[
                  { titulo: "Em conta", total: guardado.totalConta, itens: guardado.emConta },
                  { titulo: "Reservas", total: guardado.totalReservas, itens: guardado.reservas },
                ].map((g) => (
                  <div key={g.titulo}>
                    <p className="flex justify-between font-medium">
                      {g.titulo} <Dinheiro valor={g.total} />
                    </p>
                    <ul className="text-xs text-slate-500">
                      {g.itens.map((i) => (
                        <li key={i.id} className="flex justify-between gap-2">
                          <span className="min-w-0 truncate">
                            {i.nome} · {nomeDono(i.dono_membro_id)}
                          </span>
                          <Dinheiro valor={i.valor} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Cartao>

            <div className="flex min-w-0 flex-col">
              {evolucao.length > 0 && <GraficoGuardado dados={evolucao} />}
              {ativas.length > 1 && saldos.some((s) => ativas.some((r) => r.id === s.reserva_id)) && (
                <GraficoReservas reservas={ativas} saldos={saldos} />
              )}
            </div>
          </div>

          <Botao className="mb-4 w-full lg:w-auto" onClick={() => setForm("nova")}>
            <Plus className="size-4" /> Nova reserva
          </Botao>

          {reservas.length === 0 ? (
            <Vazio titulo="Nenhuma reserva" texto="Cadastre seus CDBs e atualize o saldo de vez em quando para acompanhar a evolução." />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {reservas.map((r) => {
                const s = saldoAtual(r.id, saldos);
                const historicoR = saldos.filter((x) => x.reserva_id === r.id);
                const meta = r.meta_valor
                  ? resumoMeta({
                      saldo: s?.valor ?? 0,
                      meta: r.meta_valor,
                      data: r.meta_data ?? null,
                      inicio: historicoR[0]?.data ?? hoje,
                      historico: historicoR,
                      hoje,
                    })
                  : null;
                return (
                  <Cartao key={r.id} className={r.ativa ? "" : "opacity-60"}>
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" className="min-w-0 text-left" onClick={() => setForm(r)}>
                        <p className="truncate font-semibold">{r.nome}</p>
                        <p className="text-xs text-slate-500">
                          {[r.banco, nomeDono(r.dono_membro_id)].filter(Boolean).join(" · ")}
                          {!r.ativa && " · encerrada"}
                        </p>
                        {r.observacao && <p className="text-xs text-slate-500">{r.observacao}</p>}
                        {(r.automatica || aplicacoesDe(r.id).length > 0) && (
                          <p className="mt-1">
                            <Selo cor="azul">automática (Open Finance)</Selo>
                          </p>
                        )}
                      </button>
                      <div className="text-right">
                        <Dinheiro valor={s?.valor ?? 0} className="font-semibold" />
                        <p className="text-xs text-slate-500">{s ? `em ${formatarData(s.data)}` : "sem saldo"}</p>
                      </div>
                    </div>
                    {meta && <BlocoMeta meta={meta} data={r.meta_data ?? null} />}
                    <div className="mt-3 flex gap-2">
                      {!(r.automatica || aplicacoesDe(r.id).length > 0) && (
                        <Botao variante="secundario" className="!min-h-9 flex-1" onClick={() => setAtualizando(r)}>
                          Atualizar saldo
                        </Botao>
                      )}
                      <Botao variante="fantasma" className="!min-h-9" onClick={() => setForm(r)}>
                        Editar
                      </Botao>
                      <Botao variante="fantasma" className="!min-h-9" onClick={() => setHistorico(r)}>
                        Histórico
                      </Botao>
                    </div>
                    {aplicacoesDe(r.id).length > 0 && (
                      <Aplicacoes
                        aplicacoes={aplicacoesDe(r.id)}
                        reservas={dados?.reservas ?? []}
                        todas={dados?.investimentos ?? []}
                        reservaId={r.id}
                        aoMover={recarregar}
                      />
                    )}
                  </Cartao>
                );
              })}
            </div>
          )}
        </>
      )}
      {form && (
        <FormReserva
          reserva={form === "nova" ? undefined : form}
          reservas={dados?.reservas ?? []}
          saldos={saldos}
          aoFechar={() => setForm(null)}
        />
      )}
      {atualizando && (
        <FormSaldo reserva={atualizando} atual={saldoAtual(atualizando.id, saldos)?.valor ?? 0} aoFechar={() => setAtualizando(null)} />
      )}
      {historico && (
        <Historico reserva={historico} saldos={saldos.filter((s) => s.reserva_id === historico.id)} aoFechar={() => setHistorico(null)} />
      )}
    </>
  );
}

const COR_SITUACAO: Record<SituacaoMeta, "verde" | "azul" | "amarelo" | "vermelho" | "slate"> = {
  concluida: "verde",
  adiantada: "verde",
  no_ritmo: "azul",
  atrasada: "amarelo",
  vencida: "vermelho",
  sem_data: "slate",
};

/** Progresso da meta da reserva: barra, situação, quanto guardar por mês e previsão. */
function BlocoMeta({ meta, data }: { meta: ReturnType<typeof resumoMeta>; data: string | null }) {
  return (
    <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          Meta <span className="valor-oculto font-semibold text-slate-700 dark:text-slate-200">{formatarReais(meta.meta)}</span>
          {data && ` até ${formatarData(data)}`}
        </span>
        <Selo cor={COR_SITUACAO[meta.situacao]}>{ROTULO_SITUACAO[meta.situacao]}</Selo>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className="h-full rounded-full bg-marca-500" style={{ width: `${Math.min(100, meta.progresso * 100)}%` }} />
      </div>
      <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-slate-500">
        <span>{Math.floor(meta.progresso * 100)}%</span>
        {meta.falta > 0 && (
          <span>
            falta <span className="valor-oculto">{formatarReais(meta.falta)}</span>
            {meta.porMes !== null && (
              <>
                {" · "}
                <span className="valor-oculto">{formatarReais(meta.porMes)}</span>/mês
              </>
            )}
          </span>
        )}
      </p>
      {meta.falta > 0 && meta.ritmo !== null && (
        <p className="mt-1 text-xs text-slate-500">
          Ritmo dos últimos meses: <span className="valor-oculto">{formatarReais(meta.ritmo)}</span>/mês
          {meta.previsao && <> · chega lá em {nomeMesCurto(meta.previsao)}</>}
        </p>
      )}
    </div>
  );
}

/** Evolução do total guardado (contas + reservas). */
function GraficoGuardado({ dados }: { dados: { data: string; contas: number; reservas: number; total: number }[] }) {
  const cores = useCoresGrafico();
  const variacao = dados.length > 1 ? dados[dados.length - 1].total - dados[0].total : 0;
  return (
    <Cartao className="mb-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Evolução do total guardado</h2>
          <p className="text-xs text-slate-500">desde {formatarData(dados[0].data)}</p>
        </div>
        {dados.length > 1 && (
          <div className="text-right">
            <p className="text-[11px] tracking-wide text-slate-500 uppercase">Variação</p>
            <Dinheiro valor={variacao} sinal className="font-semibold" />
          </div>
        )}
      </div>
      {dados.length < 2 && (
        <p className="mb-2 text-xs text-slate-500">O histórico começa agora: a cada sincronização entra um ponto novo e a linha vai se formando.</p>
      )}
      <div className="h-52" role="img" aria-label="Gráfico da evolução do total guardado">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="guardado-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cores.positivo} stopOpacity={0.25} />
                <stop offset="100%" stopColor={cores.positivo} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={cores.grade} vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="data"
              tickFormatter={(d: string) => formatarDiaMes(d)}
              tick={{ fill: cores.textoSecundario, fontSize: 11 }}
              stroke={cores.grade}
              tickLine={false}
              minTickGap={16}
            />
            <YAxis tickFormatter={reaisCurto} tick={{ fill: cores.textoSecundario, fontSize: 11 }} stroke="transparent" width={56} />
            <Tooltip
              formatter={(v) => [formatarReais(Number(v)), "Total guardado"]}
              labelFormatter={(d) => formatarData(String(d))}
              contentStyle={{ background: cores.superficie, borderColor: cores.grade, borderRadius: 12, color: cores.texto, fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={cores.positivo}
              strokeWidth={2.5}
              fill="url(#guardado-area)"
              dot={dados.length < 8 ? { r: 4 } : false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Cartao>
  );
}

function GraficoReservas({ reservas, saldos }: { reservas: Reserva[]; saldos: ReservaSaldo[] }) {
  const cores = useCoresGrafico();
  const dados = serieReservas(reservas, saldos);
  // Até 7 reservas ganham linha própria (cores fixas por ordem); o total usa a primeira cor.
  const comLinha = reservas.length > 1 && reservas.length <= 7 ? reservas : [];
  return (
    <Cartao className="mb-4">
      <Titulo>Evolução por reserva</Titulo>
      {dados.length < 2 && (
        <p className="-mt-2 mb-2 text-xs text-slate-500">O histórico começa agora: a cada sincronização entra um ponto novo e a linha vai se formando.</p>
      )}
      <div className="h-56" role="img" aria-label="Gráfico da evolução do saldo das reservas">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={cores.grade} vertical={false} />
            <XAxis
              dataKey="data"
              tickFormatter={(d: string) => formatarDiaMes(d)}
              tick={{ fill: cores.textoSecundario, fontSize: 11 }}
              stroke={cores.grade}
            />
            <YAxis tickFormatter={reaisCurto} tick={{ fill: cores.textoSecundario, fontSize: 11 }} stroke={cores.grade} width={60} />
            <Tooltip
              formatter={(v) => formatarReais(Number(v))}
              labelFormatter={(d) => formatarData(String(d))}
              contentStyle={{ background: cores.superficie, borderColor: cores.grade, borderRadius: 12, color: cores.texto }}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="Total"
              stroke={cores.serie[0]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            {comLinha.map((r, i) => (
              <Line
                key={r.id}
                type="monotone"
                dataKey={r.id}
                name={r.nome}
                stroke={cores.serie[i + 1]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
            {comLinha.length > 0 && (
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: cores.textoSecundario }}>{v}</span>} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Cartao>
  );
}

export interface Investimento {
  id: string;
  nome: string;
  tipo: string | null;
  subtipo: string | null;
  emissor: string | null;
  vencimento: string | null;
  saldo: number;
  status: string | null;
  reserva_id: string | null;
  pluggy_item_id: string;
}

function FormReserva({
  reserva,
  reservas,
  saldos,
  aoFechar,
}: {
  reserva?: Reserva;
  reservas: Reserva[];
  saldos: ReservaSaldo[];
  aoFechar: () => void;
}) {
  const { casa, membros, nomeDono, atualizar } = useApp();
  const automatica = !!reserva?.automatica;
  // Grupos automáticos que esta reserva pode assumir, ordenados por dono e banco.
  const grupos = reservas
    .filter((r) => r.automatica && r.id !== reserva?.id)
    .sort((a, b) => nomeDono(a.dono_membro_id).localeCompare(nomeDono(b.dono_membro_id)) || (a.banco ?? "").localeCompare(b.banco ?? ""));
  const [grupo, setGrupo] = useState("");
  const [nome, setNome] = useState(reserva?.nome ?? "");
  const [banco, setBanco] = useState(reserva?.banco ?? "");
  const [dono, setDono] = useState(reserva?.dono_membro_id ?? "");
  const [obs, setObs] = useState(reserva?.observacao ?? "");
  const [ativa, setAtiva] = useState(reserva?.ativa ?? true);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [metaValor, setMetaValor] = useState(reserva?.meta_valor ?? 0);
  const [metaData, setMetaData] = useState(reserva?.meta_data ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return setErro("Informe o nome.");
    setSalvando(true);
    try {
      const dados = {
        casa_id: casa.id,
        nome: nome.trim(),
        banco: banco.trim() || null,
        dono_membro_id: dono || null,
        observacao: obs.trim() || null,
        ativa,
        meta_valor: metaValor > 0 ? metaValor : null,
        meta_data: metaValor > 0 && metaData ? metaData : null,
      };
      const sb = supabase();
      let reservaId = reserva?.id;
      if (reserva) checar(await sb.from("reservas").update(dados).eq("id", reserva.id));
      else {
        const nova = checar(await sb.from("reservas").insert(dados).select("id").single()) as { id: string };
        reservaId = nova.id;
        if (saldoInicial > 0 && !grupo)
          checar(await sb.from("reserva_saldos").insert({ casa_id: casa.id, reserva_id: nova.id, data: hojeISO(), valor: saldoInicial }));
      }
      // Assumir um grupo do banco: as aplicações e o histórico passam para esta reserva.
      if (grupo)
        await assumirGrupo(
          reservaId!,
          grupos.find((g) => g.id === grupo)!,
        );
      await atualizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!reserva || !confirm(`Excluir a reserva “${reserva.nome}” e todo o histórico de saldos?`)) return;
    try {
      checar(await supabase().from("reservas").delete().eq("id", reserva.id));
      await atualizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={reserva ? "Editar reserva" : "Nova reserva"}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Campo rotulo="Nome" placeholder="Ex.: CDB reserva de emergência" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Campo rotulo="Banco" value={banco} onChange={(e) => setBanco(e.target.value)} />
        <SeletorDono valor={dono} aoMudar={setDono} membros={membros} />
        <AreaTexto rotulo="Observação" placeholder="Ex.: 110% do CDI, vence em 2028" value={obs} onChange={(e) => setObs(e.target.value)} />
        {!automatica && grupos.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="grupo-banco" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Usar um grupo do banco (Open Finance)
            </label>
            <select
              id="grupo-banco"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">— não usar (saldo manual) —</option>
              {membros
                .map((m) => m.id)
                .concat([""])
                .map((donoId) => {
                  const doDono = grupos.filter((g) => (g.dono_membro_id ?? "") === donoId);
                  if (!doDono.length) return null;
                  return (
                    <optgroup key={donoId || "casal"} label={nomeDono(donoId || null)}>
                      {doDono.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nome} · {formatarReais(saldoAtual(g.id, saldos)?.valor ?? 0)}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
            </select>
            <p className="text-xs text-slate-500">
              As aplicações do grupo e o histórico de saldos passam para esta reserva, que passa a se atualizar sozinha.
            </p>
          </div>
        )}
        {automatica && (
          <p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
            Reserva automática: o saldo vem das aplicações do banco a cada sincronização. Você pode renomear, mudar o dono ou tirar do
            total.
          </p>
        )}
        {!reserva && !grupo && <CampoValor rotulo="Saldo atual" valor={saldoInicial} aoMudar={setSaldoInicial} />}
        <fieldset className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <legend className="sr-only">Meta</legend>
          <p className="text-sm font-medium">Meta (opcional)</p>
          <CampoValor rotulo="Quanto quer juntar" valor={metaValor} aoMudar={setMetaValor} dica="Zero = sem meta." />
          {metaValor > 0 && (
            <Campo rotulo="Até quando (opcional)" type="date" value={metaData} onChange={(e) => setMetaData(e.target.value)} />
          )}
        </fieldset>
        {reserva && <Interruptor rotulo="Contar no total guardado" marcado={ativa} aoMudar={setAtiva} />}
        <Erro mensagem={erro} />
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
        {reserva && (
          <Botao variante="fantasma" className="text-red-600" onClick={excluir}>
            Excluir
          </Botao>
        )}
      </form>
    </Modal>
  );
}

function FormSaldo({ reserva, atual, aoFechar }: { reserva: Reserva; atual: number; aoFechar: () => void }) {
  const { casa, atualizar } = useApp();
  const [valor, setValor] = useState(atual);
  const [data, setData] = useState(hojeISO());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      checar(await supabase().from("reserva_saldos").insert({ casa_id: casa.id, reserva_id: reserva.id, data, valor }));
      await atualizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Saldo: ${reserva.nome}`}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <CampoValor rotulo="Saldo" valor={valor} aoMudar={setValor} autoFocus />
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <Erro mensagem={erro} />
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </form>
    </Modal>
  );
}

function Historico({ reserva, saldos, aoFechar }: { reserva: Reserva; saldos: ReservaSaldo[]; aoFechar: () => void }) {
  const { atualizar } = useApp();
  const [erro, setErro] = useState<string | null>(null);
  const lista = [...saldos].sort((a, b) => (a.data < b.data ? 1 : -1));
  async function excluir(s: ReservaSaldo) {
    if (!confirm("Excluir este registro de saldo?")) return;
    try {
      checar(await supabase().from("reserva_saldos").delete().eq("id", s.id));
      await atualizar();
    } catch (e) {
      setErro(formatarErro(e));
    }
  }
  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Histórico: ${reserva.nome}`}>
      <Erro mensagem={erro} />
      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum saldo registrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1 font-medium">Data</th>
                <th className="py-1 text-right font-medium">Saldo</th>
                <th className="sr-only">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2">{formatarData(s.data)}</td>
                  <td className="py-2 text-right tabular-nums">{formatarReais(s.valor)}</td>
                  <td className="py-2 text-right">
                    <button type="button" className="text-xs text-red-600" onClick={() => excluir(s)}>
                      excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function Aplicacoes({
  aplicacoes,
  reservas,
  todas,
  reservaId,
  aoMover,
}: {
  aplicacoes: Investimento[];
  reservas: Reserva[];
  todas: Investimento[];
  reservaId: string;
  aoMover: () => void;
}) {
  const { casa } = useApp();
  const [erro, setErro] = useState<string | null>(null);
  const destinos = reservas.filter((r) => r.id !== reservaId && r.ativa);
  async function mover(a: Investimento, destino: string) {
    setErro(null);
    try {
      await moverAplicacao(
        casa.id,
        { ...a, saldo: Number(a.saldo) },
        destino,
        todas.map((i) => ({ ...i, saldo: Number(i.saldo) })),
      );
      aoMover();
    } catch (e) {
      setErro(formatarErro(e));
    }
  }
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-slate-500">Aplicações ({aplicacoes.length})</summary>
      <Erro mensagem={erro} />
      <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
        {aplicacoes.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 py-1.5">
            <span className="min-w-0 flex-1 truncate text-xs">
              {a.nome}
              {a.vencimento && <span className="text-slate-500"> · vence {formatarData(a.vencimento)}</span>}
            </span>
            <Dinheiro valor={Number(a.saldo)} className="text-xs font-medium" />
            {destinos.length > 0 && (
              <select
                aria-label={`Mover ${a.nome} para outra reserva`}
                value=""
                onChange={(e) => e.target.value && mover(a, e.target.value)}
                className="min-h-8 max-w-full rounded-lg border border-slate-300 bg-white px-1 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">Mover para…</option>
                {destinos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
