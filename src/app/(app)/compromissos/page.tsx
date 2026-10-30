"use client";

import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { daVisao, useApp, useCarregar } from "@/components/app-contexto";
import { Cabecalho } from "@/components/cabecalho";
import { ModalExcluirRegra } from "@/components/excluir";
import { FormCartao, FormContrato, FormDivida } from "@/components/form-compromissos";
import { ModalOcorrencia, ModalPagar, SeloStatus, valorEfetivo } from "@/components/ocorrencias";
import { Abas, Barra, Botao, Cartao, Carregando, Dinheiro, Erro, Selo, Vazio } from "@/components/ui";
import { resumoContrato, resumoDivida } from "@/lib/compromissos";
import { formatarData, hojeISO } from "@/lib/datas";
import { buscarTodos, checar } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { supabase } from "@/lib/supabase";
import type { Cartao as TCartao, Contrato, Divida, Ocorrencia, Recorrencia } from "@/lib/tipos";

type Aba = "parcelados" | "dividas" | "cartoes";

export default function Compromissos() {
  // O shell só renderiza as telas no navegador, então dá para ler o sessionStorage.
  const [aba, setAbaEstado] = useState<Aba>(() => (sessionStorage.getItem("aba-compromissos") as Aba) || "parcelados");
  const setAba = (a: Aba) => {
    setAbaEstado(a);
    sessionStorage.setItem("aba-compromissos", a);
  };
  return (
    <>
      <Cabecalho titulo="Compromissos" />
      <Abas
        abas={[
          { valor: "parcelados", rotulo: "Parcelados" },
          { valor: "dividas", rotulo: "Dívidas" },
          { valor: "cartoes", rotulo: "Cartões" },
        ]}
        atual={aba}
        aoMudar={setAba}
      />
      {aba === "parcelados" && <Parcelados />}
      {aba === "dividas" && <Dividas />}
      {aba === "cartoes" && <Cartoes />}
    </>
  );
}

function Parcelados() {
  const { casa, visao } = useApp();
  const [novo, setNovo] = useState(false);
  const { dados, erro, carregando } = useCarregar("parcelados", async () => {
    const [contratos, ocorrencias] = await Promise.all([
      buscarTodos<Contrato>("contratos", casa.id, undefined, "nome"),
      buscarTodos<Ocorrencia>("ocorrencias", casa.id, (q) => q.eq("origem_tipo", "parcela_contrato")),
    ]);
    return { contratos, ocorrencias };
  });
  const contratos = daVisao(dados?.contratos ?? [], visao);

  return (
    <>
      <Botao className="mb-4 w-full lg:w-auto" onClick={() => setNovo(true)}>
        <Plus className="size-4" /> Novo parcelado
      </Botao>
      <Erro mensagem={erro} />
      {carregando && !dados ? (
        <Carregando />
      ) : contratos.length === 0 ? (
        <Vazio titulo="Nenhum parcelado" texto="Cadastre aqui a construtora, um financiamento ou qualquer compromisso com parcelas." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {contratos.map((c) => {
            const r = resumoContrato(c, dados!.ocorrencias);
            return (
              <Link key={c.id} href={`/compromissos/parcelado/${c.id}`}>
                <Cartao className="hover:border-emerald-400">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.nome}</p>
                      <p className="text-xs text-slate-500">
                        {r.pagas}/{c.num_parcelas} parcelas · {c.credor}
                      </p>
                    </div>
                    {r.restantes === 0 ? <Selo cor="verde">quitado</Selo> : <ChevronRight className="size-4 text-slate-400" />}
                  </div>
                  <Barra valor={r.totalPago} total={c.valor_total} />
                  <p className="mt-1 text-xs text-slate-500">
                    Pago {formatarReais(r.totalPago)} de {formatarReais(c.valor_total)}
                  </p>
                </Cartao>
              </Link>
            );
          })}
        </div>
      )}
      {novo && <FormContrato aoFechar={() => setNovo(false)} />}
    </>
  );
}

function Dividas() {
  const { casa, visao } = useApp();
  const [nova, setNova] = useState(false);
  const { dados, erro, carregando } = useCarregar("dividas", async () => {
    const [dividas, ocorrencias] = await Promise.all([
      buscarTodos<Divida>("dividas", casa.id, undefined, "descricao"),
      buscarTodos<Ocorrencia>("ocorrencias", casa.id, (q) => q.in("origem_tipo", ["pagamento_divida", "meta_divida"])),
    ]);
    return { dividas, ocorrencias };
  });
  const dividas = daVisao(dados?.dividas ?? [], visao);
  const resumos = dividas
    .map((d) => ({ d, r: resumoDivida(d, dados!.ocorrencias) }))
    .sort((a, b) => Number(a.r.quitada) - Number(b.r.quitada));

  return (
    <>
      <Botao className="mb-4 w-full lg:w-auto" onClick={() => setNova(true)}>
        <Plus className="size-4" /> Nova dívida
      </Botao>
      <Erro mensagem={erro} />
      {carregando && !dados ? (
        <Carregando />
      ) : dividas.length === 0 ? (
        <Vazio
          titulo="Nenhuma dívida"
          texto="Para dívidas sem parcelas fixas (ex.: o carro): você paga quando puder, com uma meta mensal opcional."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {resumos.map(({ d, r }) => (
            <Link key={d.id} href={`/compromissos/divida/${d.id}`}>
              <Cartao className={r.quitada ? "opacity-70" : "hover:border-emerald-400"}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{d.descricao}</p>
                    <p className="text-xs text-slate-500">
                      {d.credor}
                      {d.meta_mensal ? ` · meta ${formatarReais(d.meta_mensal)}/mês` : ""}
                    </p>
                  </div>
                  {r.quitada ? <Selo cor="verde">concluída</Selo> : <ChevronRight className="size-4 text-slate-400" />}
                </div>
                <Barra valor={r.pago} total={d.valor_total} />
                <p className="mt-1 text-xs text-slate-500">
                  {r.percentual}% quitado · falta {formatarReais(r.restante)}
                </p>
              </Cartao>
            </Link>
          ))}
        </div>
      )}
      {nova && <FormDivida aoFechar={() => setNova(false)} />}
    </>
  );
}

function Cartoes() {
  const { casa, visao } = useApp();
  const [editando, setEditando] = useState<TCartao | "novo" | null>(null);
  const [excluindo, setExcluindo] = useState<{ cartao: TCartao; regraId: string } | null>(null);
  const [aberta, setAberta] = useState<Ocorrencia | null>(null);
  const [pagando, setPagando] = useState<Ocorrencia | null>(null);
  const hoje = hojeISO();
  const { dados, erro, carregando } = useCarregar("cartoes", async () => {
    const [cartoes, regras, faturas] = await Promise.all([
      buscarTodos<TCartao>("cartoes", casa.id, undefined, "nome"),
      buscarTodos<Recorrencia>("recorrencias", casa.id, (q) => q.not("cartao_id", "is", null)),
      buscarTodos<Ocorrencia>("ocorrencias", casa.id, (q) => q.eq("origem_tipo", "fatura").neq("status", "cancelado"), "vencimento"),
    ]);
    return { cartoes, regras, faturas };
  });
  const cartoes = daVisao(dados?.cartoes ?? [], visao);

  return (
    <>
      <Botao className="mb-4 w-full lg:w-auto" onClick={() => setEditando("novo")}>
        <Plus className="size-4" /> Novo cartão
      </Botao>
      <Erro mensagem={erro} />
      {carregando && !dados ? (
        <Carregando />
      ) : cartoes.length === 0 ? (
        <Vazio titulo="Nenhum cartão" texto="Cada cartão vira uma despesa mensal “Fatura”. Você ajusta o valor quando a fatura fecha." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {cartoes.map((c) => {
            const regra = dados!.regras.find((r) => r.cartao_id === c.id);
            const faturas = dados!.faturas.filter((f) => f.origem_id === regra?.id);
            const proximas = faturas.filter((f) => f.status === "pendente").slice(0, 2);
            const ultimaPaga = faturas.filter((f) => f.status === "pago").at(-1);
            return (
              <Cartao key={c.id}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.nome}</p>
                    <p className="text-xs text-slate-500">
                      Vence dia {c.dia_vencimento}
                      {c.dia_fechamento ? ` · fecha dia ${c.dia_fechamento}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Link
                      href={`/compromissos/cartao/${c.id}`}
                      className="inline-flex min-h-9 items-center rounded-xl px-2 text-sm font-medium text-emerald-700 hover:bg-slate-200 dark:text-emerald-400 dark:hover:bg-slate-800"
                    >
                      Detalhes
                    </Link>
                    <Botao variante="fantasma" className="!min-h-9 !px-2" onClick={() => setEditando(c)}>
                      Editar
                    </Botao>
                    <Botao
                      variante="fantasma"
                      className="!min-h-9 !px-2 text-red-600"
                      onClick={() => regra && setExcluindo({ cartao: c, regraId: regra.id })}
                    >
                      Excluir
                    </Botao>
                  </div>
                </div>
                <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {proximas.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 py-2">
                      <button type="button" className="flex flex-1 items-center gap-2 text-left" onClick={() => setAberta(f)}>
                        <span className="flex-1">
                          Fatura {formatarData(f.vencimento)} <SeloStatus o={f} />
                        </span>
                        <Dinheiro valor={f.valor_previsto} className="font-semibold" />
                      </button>
                      {f.vencimento <= hoje || f === proximas[0] ? (
                        <Botao variante="secundario" className="!min-h-9 !px-3" onClick={() => setPagando(f)}>
                          Pagar
                        </Botao>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {ultimaPaga && (
                  <p className="mt-1 text-xs text-slate-500">
                    Última paga: {formatarReais(valorEfetivo(ultimaPaga))} em {formatarData(ultimaPaga.pago_em)}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">Toque numa fatura para ajustar o valor do mês.</p>
              </Cartao>
            );
          })}
        </div>
      )}
      {editando && <FormCartao cartao={editando === "novo" ? undefined : editando} aoFechar={() => setEditando(null)} />}
      {excluindo && (
        <ModalExcluirRegra
          nome={excluindo.cartao.nome}
          origemId={excluindo.regraId}
          excluir={async () => {
            checar(await supabase().from("cartoes").delete().eq("id", excluindo.cartao.id));
          }}
          aoFechar={() => setExcluindo(null)}
        />
      )}
      <ModalOcorrencia o={aberta} aoFechar={() => setAberta(null)} aoPagar={setPagando} />
      <ModalPagar o={pagando} aoFechar={() => setPagando(null)} />
    </>
  );
}
