"use client";

import clsx from "clsx";
import { AlertTriangle, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp, useCarregar } from "@/components/app-contexto";
import { Cabecalho } from "@/components/cabecalho";
import { Abas, Botao, Campo, CampoValor, Cartao, Carregando, Dinheiro, Erro, formatarErro, Modal, Selo, Vazio } from "@/components/ui";
import { formatarData, hojeISO, mesDe, nomeMes, somarMeses } from "@/lib/datas";
import { buscarTodos, checar } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { resumoMesRacha, ROTULO_RACHA, saldoRacha } from "@/lib/racha";
import { supabase } from "@/lib/supabase";
import type { RachaMovimento, RachaTipo, Tipo } from "@/lib/tipos";

export default function Racha() {
  const { casa, nomeDono } = useApp();
  const [mes, setMes] = useState(mesDe(hojeISO()));
  const [novo, setNovo] = useState<RachaTipo | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const { dados, erro, carregando, recarregar } = useCarregar("racha", () =>
    buscarTodos<RachaMovimento>("racha_movimentos", casa.id, undefined, "data"),
  );

  if (!casa.racha_ativo)
    return (
      <>
        <Cabecalho titulo="Caixa do racha" semVisao />
        <Vazio
          titulo="Módulo desativado"
          texto="O caixa do racha controla o dinheiro dos jogadores (fora das finanças do casal). Ative em Configurações."
          acao={
            <Link href="/configuracoes" className="text-sm font-medium text-emerald-600">
              Ir para Configurações
            </Link>
          }
        />
      </>
    );

  const movs = dados ?? [];
  const saldo = saldoRacha(movs);
  const resumo = resumoMesRacha(movs, mes);
  const doMes = movs.filter((m) => mesDe(m.data) === mes).reverse();

  async function excluir(m: RachaMovimento) {
    if (!confirm("Excluir este movimento?")) return;
    try {
      checar(await supabase().from("racha_movimentos").delete().eq("id", m.id));
      recarregar();
    } catch (e) {
      setErroAcao(formatarErro(e));
    }
  }

  return (
    <>
      <Cabecalho titulo="Caixa do racha" semVisao />
      <p className="-mt-2 mb-4 text-xs text-slate-500">
        Organizado por {nomeDono(casa.racha_membro_id)}. Dinheiro dos jogadores: não entra na sobra, na projeção nem nos gráficos.
      </p>
      <Erro mensagem={erro ?? erroAcao} />
      {carregando && !dados ? (
        <Carregando />
      ) : (
        <>
          <div className="lg:grid lg:grid-cols-[22rem_1fr] lg:items-start lg:gap-6">
            <div className="lg:sticky lg:top-6">
              <Cartao className={clsx("mb-4 text-center", saldo < 0 && "border-red-300 dark:border-red-900")}>
                <p className="text-sm text-slate-500">Saldo do caixa</p>
                <Dinheiro valor={saldo} sinal className="text-3xl font-bold" />
                {saldo < 0 && (
                  <p className="mt-2 flex items-center justify-center gap-1 text-sm font-medium text-red-600 dark:text-red-400">
                    <AlertTriangle className="size-4" aria-hidden /> Você está cobrindo do seu bolso
                  </p>
                )}
              </Cartao>

              <div className="mb-4 grid grid-cols-2 gap-2">
                <Botao onClick={() => setNovo("mensalidade")}>
                  <Plus className="size-4" /> Mensalidade
                </Botao>
                <Botao onClick={() => setNovo("diaria")}>
                  <Plus className="size-4" /> Diária
                </Botao>
                <Botao onClick={() => setNovo("amistoso")}>
                  <Plus className="size-4" /> Amistoso
                </Botao>
                <Botao variante="perigo" onClick={() => setNovo("juiz")}>
                  <Minus className="size-4" /> Juiz
                </Botao>
                <Botao variante="secundario" className="col-span-2" onClick={() => setNovo("outro")}>
                  Outro movimento
                </Botao>
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() => setMes(somarMeses(mes, -1))}
                  className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <span className="font-semibold first-letter:uppercase">{nomeMes(mes)}</span>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() => setMes(somarMeses(mes, 1))}
                  className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-800"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
              <Cartao className="mb-4">
                <div className="mb-2 grid grid-cols-2 text-center text-sm">
                  <div>
                    <p className="text-slate-500">Entrou</p>
                    <Dinheiro valor={resumo.entrou} className="font-semibold text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-slate-500">Saiu</p>
                    <Dinheiro valor={resumo.saiu} className="font-semibold text-red-600 dark:text-red-400" />
                  </div>
                </div>
                {doMes.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500">Nenhum movimento neste mês.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {doMes.map((m) => (
                      <li key={m.id} className="flex items-center gap-2 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {ROTULO_RACHA[m.tipo]} {m.descricao && <span className="font-normal text-slate-500">· {m.descricao}</span>}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatarData(m.data)} {m.transacao_importada_id && <Selo cor="azul">importado</Selo>}
                          </p>
                        </div>
                        <Dinheiro valor={m.sentido === "entrada" ? m.valor : -m.valor} sinal className="text-sm font-semibold" />
                        <button
                          type="button"
                          onClick={() => excluir(m)}
                          className="text-xs text-slate-400 hover:text-red-600"
                          aria-label="Excluir movimento"
                        >
                          excluir
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Cartao>
            </div>
          </div>
        </>
      )}
      {novo && (
        <FormMovimento
          tipo={novo}
          aoFechar={() => setNovo(null)}
          aoSalvar={() => {
            setNovo(null);
            recarregar();
          }}
        />
      )}
    </>
  );
}

function FormMovimento({ tipo, aoFechar, aoSalvar }: { tipo: RachaTipo; aoFechar: () => void; aoSalvar: () => void }) {
  const { casa } = useApp();
  const padrao =
    tipo === "mensalidade" ? casa.racha_mensalidade : tipo === "diaria" ? casa.racha_diaria : tipo === "juiz" ? casa.racha_juiz : 0;
  const comQuantidade = tipo === "mensalidade" || tipo === "diaria" || tipo === "juiz";
  const [quantidade, setQuantidade] = useState("1");
  const [unitario, setUnitario] = useState(padrao);
  const [sentido, setSentido] = useState<Tipo>(tipo === "juiz" ? "saida" : "entrada");
  const [data, setData] = useState(hojeISO());
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const qtd = comQuantidade ? Math.max(0, Math.floor(Number(quantidade) || 0)) : 1;
  const total = qtd * unitario;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (total <= 0) return setErro("Informe o valor.");
    setSalvando(true);
    try {
      const desc = [qtd > 1 ? `${qtd} × ${formatarReais(unitario)}` : "", descricao.trim()].filter(Boolean).join(" · ");
      checar(
        await supabase()
          .from("racha_movimentos")
          .insert({ casa_id: casa.id, data, tipo, sentido, valor: total, descricao: desc || null }),
      );
      aoSalvar();
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={ROTULO_RACHA[tipo]}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        {tipo === "outro" && (
          <Abas
            abas={[
              { valor: "entrada", rotulo: "Entrada" },
              { valor: "saida", rotulo: "Saída" },
            ]}
            atual={sentido}
            aoMudar={setSentido}
          />
        )}
        {comQuantidade && (
          <Campo
            rotulo="Quantidade"
            type="number"
            inputMode="numeric"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        )}
        <CampoValor rotulo={comQuantidade ? "Valor de cada" : "Valor"} valor={unitario} aoMudar={setUnitario} autoFocus={!comQuantidade} />
        {comQuantidade && qtd > 1 && (
          <p className="text-sm text-slate-500">
            Total: {qtd} × {formatarReais(unitario)} = <strong>{formatarReais(total)}</strong>
          </p>
        )}
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <Campo rotulo="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <Erro mensagem={erro} />
        <Botao type="submit" carregando={salvando} variante={sentido === "saida" ? "perigo" : "primario"}>
          {sentido === "saida" ? "Registrar saída" : "Registrar entrada"} de {formatarReais(total)}
        </Botao>
      </form>
    </Modal>
  );
}
