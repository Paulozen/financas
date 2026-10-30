"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  Selecao,
  Selo,
  Titulo,
  Vazio,
} from "@/components/ui";
import { formatarData, formatarDiaMes, hojeISO } from "@/lib/datas";
import { buscarTodos, checar } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { reaisCurto, useCoresGrafico } from "@/lib/graficos";
import { resumoGuardado, saldoAtual, serieReservas, type ContaGuardada } from "@/lib/reservas";
import { supabase } from "@/lib/supabase";
import type { Reserva, ReservaSaldo } from "@/lib/tipos";

export default function Reservas() {
  const { casa, visao, nomeDono } = useApp();
  const [form, setForm] = useState<Reserva | "nova" | null>(null);
  const [atualizando, setAtualizando] = useState<Reserva | null>(null);
  const [historico, setHistorico] = useState<Reserva | null>(null);
  const { dados, erro, carregando } = useCarregar("reservas", async () => {
    const [reservas, saldos, investimentos, contas] = await Promise.all([
      buscarTodos<Reserva>("reservas", casa.id, undefined, "nome"),
      buscarTodos<ReservaSaldo>("reserva_saldos", casa.id, undefined, "data"),
      buscarTodos<Investimento>("investimentos_externos", casa.id, undefined, "nome"),
      buscarTodos<ContaGuardada>("contas_externas", casa.id, undefined, "nome"),
    ]);
    return { reservas, saldos, investimentos, contas };
  });
  const reservas = daVisao(dados?.reservas ?? [], visao);
  const saldos = dados?.saldos ?? [];
  const ativas = reservas.filter((r) => r.ativa);
  const guardado = resumoGuardado(dados?.reservas ?? [], saldos, dados?.contas ?? [], visao);

  return (
    <>
      <Cabecalho titulo="Reservas" />
      <Erro mensagem={erro} />
      {carregando && !dados ? (
        <Carregando />
      ) : (
        <>
          <div className="lg:grid lg:grid-cols-[18rem_1fr] lg:items-start lg:gap-4">
            <Cartao className="mb-4 text-center lg:py-10">
              <p className="text-sm text-slate-500">Total guardado</p>
              <Dinheiro valor={guardado.total} className="text-3xl font-bold" />
              <p className="mt-1 text-xs text-slate-500">Não entra na sobra do mês nem na projeção.</p>
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
                          <span className="truncate">
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

            {ativas.length > 0 && saldos.some((s) => ativas.some((r) => r.id === s.reserva_id)) && (
              <GraficoReservas reservas={ativas} saldos={saldos} />
            )}
          </div>

          <Botao className="mb-4 w-full lg:w-auto" onClick={() => setForm("nova")}>
            <Plus className="size-4" /> Nova reserva
          </Botao>

          {reservas.length === 0 ? (
            <Vazio titulo="Nenhuma reserva" texto="Cadastre seus CDBs e atualize o saldo de vez em quando para acompanhar a evolução." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {reservas.map((r) => {
                const s = saldoAtual(r.id, saldos);
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
                        {dados?.investimentos.some((i) => i.reserva_id === r.id) && (
                          <p className="mt-1">
                            <Selo cor="azul">saldo automático (Open Finance)</Selo>
                          </p>
                        )}
                      </button>
                      <div className="text-right">
                        <Dinheiro valor={s?.valor ?? 0} className="font-semibold" />
                        <p className="text-xs text-slate-500">{s ? `em ${formatarData(s.data)}` : "sem saldo"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Botao variante="secundario" className="!min-h-9 flex-1" onClick={() => setAtualizando(r)}>
                        Atualizar saldo
                      </Botao>
                      <Botao variante="fantasma" className="!min-h-9" onClick={() => setHistorico(r)}>
                        Histórico
                      </Botao>
                    </div>
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
          investimentos={dados?.investimentos ?? []}
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

function GraficoReservas({ reservas, saldos }: { reservas: Reserva[]; saldos: ReservaSaldo[] }) {
  const cores = useCoresGrafico();
  const dados = serieReservas(reservas, saldos);
  // Até 7 reservas ganham linha própria (cores fixas por ordem); o total usa a primeira cor.
  const comLinha = reservas.length > 1 && reservas.length <= 7 ? reservas : [];
  return (
    <Cartao className="mb-4">
      <Titulo>Evolução</Titulo>
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
}

function FormReserva({ reserva, investimentos, aoFechar }: { reserva?: Reserva; investimentos: Investimento[]; aoFechar: () => void }) {
  const { casa, membros, atualizar } = useApp();
  const vinculadoAntes = investimentos.find((i) => reserva && i.reserva_id === reserva.id)?.id ?? "";
  const [investimento, setInvestimento] = useState(vinculadoAntes);
  // Só investimentos ativos com saldo, que não estejam ligados a outra reserva.
  const opcoes = investimentos.filter((i) => (i.status !== "TOTAL_WITHDRAWAL" && i.saldo > 0 && !i.reserva_id) || i.id === vinculadoAntes);
  const [nome, setNome] = useState(reserva?.nome ?? "");
  const [banco, setBanco] = useState(reserva?.banco ?? "");
  const [dono, setDono] = useState(reserva?.dono_membro_id ?? "");
  const [obs, setObs] = useState(reserva?.observacao ?? "");
  const [ativa, setAtiva] = useState(reserva?.ativa ?? true);
  const [saldoInicial, setSaldoInicial] = useState(0);
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
      };
      const sb = supabase();
      let reservaId = reserva?.id;
      if (reserva) checar(await sb.from("reservas").update(dados).eq("id", reserva.id));
      else {
        const nova = checar(await sb.from("reservas").insert(dados).select("id").single()) as { id: string };
        reservaId = nova.id;
        if (saldoInicial > 0 && !investimento)
          checar(await sb.from("reserva_saldos").insert({ casa_id: casa.id, reserva_id: nova.id, data: hojeISO(), valor: saldoInicial }));
      }
      if (investimento !== vinculadoAntes) {
        // Troca o vínculo: o saldo passa a vir do investimento a cada sincronização.
        if (vinculadoAntes) checar(await sb.from("investimentos_externos").update({ reserva_id: null }).eq("id", vinculadoAntes));
        if (investimento) {
          checar(await sb.from("investimentos_externos").update({ reserva_id: reservaId }).eq("id", investimento));
          const inv = investimentos.find((i) => i.id === investimento)!;
          const hoje = hojeISO();
          const [doDia] = checar(await sb.from("reserva_saldos").select("id").eq("reserva_id", reservaId!).eq("data", hoje)) as {
            id: string;
          }[];
          if (doDia) checar(await sb.from("reserva_saldos").update({ valor: inv.saldo }).eq("id", doDia.id));
          else checar(await sb.from("reserva_saldos").insert({ casa_id: casa.id, reserva_id: reservaId, data: hoje, valor: inv.saldo }));
        }
      }
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
        {opcoes.length > 0 && (
          <Selecao
            rotulo="Investimento no banco (Open Finance)"
            value={investimento}
            onChange={(e) => setInvestimento(e.target.value)}
            vazio="— sem vínculo (saldo manual) —"
            opcoes={opcoes.map((i) => ({
              valor: i.id,
              rotulo: `${i.nome}${i.emissor ? ` · ${i.emissor}` : ""}${i.vencimento ? ` · vence ${formatarData(i.vencimento)}` : ""} · ${formatarReais(i.saldo)}`,
            }))}
          />
        )}
        {investimento && (
          <p className="-mt-2 text-xs text-slate-500">O saldo desta reserva será atualizado automaticamente a cada sincronização.</p>
        )}
        {!reserva && !investimento && <CampoValor rotulo="Saldo atual" valor={saldoInicial} aoMudar={setSaldoInicial} />}
        {reserva && <Interruptor rotulo="Ativa (conta no total guardado)" marcado={ativa} aoMudar={setAtiva} />}
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
      )}
    </Modal>
  );
}
