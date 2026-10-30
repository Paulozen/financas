"use client";

import { ArrowLeft, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp, useCarregar } from "@/components/app-contexto";
import { ModalExcluirRegra } from "@/components/excluir";
import { FormItem, FormParcelas, FormProjeto } from "@/components/form-projetos";
import { LinhaOcorrencia, ModalOcorrencia, ModalPagar } from "@/components/ocorrencias";
import { Barra, Botao, Cartao, Carregando, Dinheiro, Erro, formatarErro, Modal, Selo, Titulo, Vazio } from "@/components/ui";
import { hojeISO } from "@/lib/datas";
import { formatarData } from "@/lib/datas";
import { buscarTodos, checar } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { resumoProjeto } from "@/lib/projetos";
import { supabase } from "@/lib/supabase";
import type { Ocorrencia, Projeto, ProjetoItem } from "@/lib/tipos";

const COR_STATUS = { orçando: "amarelo", contratado: "azul", quitado: "verde" } as const;

export default function DetalheProjeto() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { casa, nomeDono, sincronizar } = useApp();
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [itemForm, setItemForm] = useState<ProjetoItem | "novo" | null>(null);
  const [itemAberto, setItemAberto] = useState<string | null>(null);
  const [parcelasDe, setParcelasDe] = useState<ProjetoItem | null>(null);
  const [excluirItem, setExcluirItem] = useState<ProjetoItem | null>(null);
  const [aberta, setAberta] = useState<Ocorrencia | null>(null);
  const [pagando, setPagando] = useState<Ocorrencia | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const { dados, erro, carregando } = useCarregar(`projeto:${id}`, async () => {
    const sb = supabase();
    const [projeto, itens] = await Promise.all([
      sb.from("projetos").select("*").eq("id", id).maybeSingle().then(checar),
      sb.from("projeto_itens").select("*").eq("projeto_id", id).order("criado_em").then(checar),
    ]);
    const ids = (itens as ProjetoItem[]).map((i) => i.id);
    const parcelas = ids.length
      ? await buscarTodos<Ocorrencia>(
          "ocorrencias",
          casa.id,
          (q) => q.eq("origem_tipo", "parcela_projeto").in("origem_id", ids),
          "vencimento",
        )
      : [];
    return { projeto: projeto as Projeto | null, itens: itens as ProjetoItem[], parcelas };
  });

  if (carregando && !dados) return <Carregando />;
  if (erro) return <Erro mensagem={erro} />;
  const p = dados?.projeto;
  if (!p) return <p>Projeto não encontrado.</p>;
  const { itens, parcelas } = dados;
  const r = resumoProjeto(itens, parcelas);
  const hoje = hojeISO();
  const proximas = parcelas.filter((o) => o.status === "pendente").slice(0, 5);
  const item = itens.find((i) => i.id === itemAberto) ?? null;

  async function excluirProjeto(removerPendentes: boolean) {
    try {
      const sb = supabase();
      if (removerPendentes && itens.length)
        checar(
          await sb
            .from("ocorrencias")
            .delete()
            .in(
              "origem_id",
              itens.map((i) => i.id),
            )
            .eq("status", "pendente"),
        );
      checar(await sb.from("projetos").delete().eq("id", p!.id));
      await sincronizar();
      router.push("/projetos");
    } catch (e) {
      setErroAcao(formatarErro(e));
    }
  }

  return (
    <>
      <Link href="/projetos" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500">
        <ArrowLeft className="size-4" /> Projetos
      </Link>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{p.nome}</h1>
        <Botao variante="fantasma" className="!min-h-9" onClick={() => setEditando(true)} aria-label="Editar projeto">
          <Pencil className="size-4" />
        </Botao>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        {p.data_evento ? `Evento em ${formatarData(p.data_evento)}` : "Sem data"} · {nomeDono(p.dono_membro_id)}
        {p.data_evento && p.data_evento >= hoje && ` · faltam ${Math.ceil((Date.parse(p.data_evento) - Date.parse(hoje)) / 86400000)} dias`}
      </p>

      <div className="lg:grid lg:grid-cols-[1fr_1.2fr] lg:items-start lg:gap-4">
        <div>
          <Cartao className="mb-4">
            <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
              <Info rotulo="Orçamento" valor={p.orcamento} />
              <Info rotulo="Orçado nos itens" valor={r.orcado} />
              <Info rotulo="Contratado" valor={r.contratado} />
              <Info rotulo="Pago" valor={r.pago} />
              <Info rotulo="Falta pagar" valor={r.faltaPagar} destaque />
              {p.orcamento > 0 ? (
                <Info rotulo="Livre no orçamento" valor={p.orcamento - Math.max(r.contratado, r.orcado)} sinal />
              ) : (
                <div>
                  <p className="text-slate-500">Livre no orçamento</p>
                  <button
                    type="button"
                    onClick={() => setEditando(true)}
                    className="text-left text-sm text-emerald-700 underline dark:text-emerald-400"
                  >
                    Defina o orçamento
                  </button>
                </div>
              )}
            </div>
            <Barra valor={r.pago} total={r.contratado} />
            <p className="mt-1 text-xs text-slate-500">
              {r.contratado > 0 ? Math.round((r.pago / r.contratado) * 100) : 0}% do contratado já foi pago
            </p>
          </Cartao>

          {proximas.length > 0 && (
            <Cartao className="mb-4">
              <Titulo>Próximas parcelas</Titulo>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {proximas.map((o) => (
                  <LinhaOcorrencia key={o.id} o={o} aoAbrir={() => setAberta(o)} aoPagar={() => setPagando(o)} />
                ))}
              </ul>
            </Cartao>
          )}
        </div>
        <Cartao className="mb-4">
          <Titulo
            acao={
              <Botao variante="fantasma" className="!min-h-9" onClick={() => setItemForm("novo")}>
                <Plus className="size-4" /> Item
              </Botao>
            }
          >
            Itens
          </Titulo>
          {itens.length === 0 ? (
            <Vazio titulo="Nenhum item" texto="Adicione os fornecedores: buffet, local, fotografia..." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {itens.map((i) => {
                const ri = resumoProjeto([i], parcelas);
                return (
                  <li key={i.id}>
                    <button type="button" onClick={() => setItemAberto(i.id)} className="flex w-full flex-col gap-1 py-3 text-left">
                      <span className="flex items-center gap-2">
                        <span className="flex-1 truncate font-medium">{i.descricao}</span>
                        <Selo cor={COR_STATUS[i.status]}>{i.status}</Selo>
                      </span>
                      <span className="text-xs text-slate-500">
                        {[
                          i.tipo_item,
                          i.fornecedor,
                          i.valor_contratado > 0
                            ? `pago ${formatarReais(ri.pago)} de ${formatarReais(i.valor_contratado)}`
                            : i.valor_orcado > 0
                              ? `orçado ${formatarReais(i.valor_orcado)}`
                              : "sem valor ainda",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {i.valor_contratado > 0 && <Barra valor={ri.pago} total={i.valor_contratado} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
      </div>
      <Botao variante="fantasma" className="w-full text-red-600 lg:w-auto" onClick={() => setExcluindo(true)}>
        Excluir projeto
      </Botao>
      <Erro mensagem={erroAcao} />

      {item && (
        <Modal aberto aoFechar={() => setItemAberto(null)} titulo={item.descricao}>
          <ItemDetalhe
            item={item}
            parcelas={parcelas.filter((o) => o.origem_id === item.id)}
            aoEditar={() => setItemForm(item)}
            aoParcelas={() => setParcelasDe(item)}
            aoExcluir={() => setExcluirItem(item)}
            aoAbrir={(o) => setAberta(o)}
            aoPagar={(o) => setPagando(o)}
          />
        </Modal>
      )}
      {editando && <FormProjeto projeto={p} aoFechar={() => setEditando(false)} />}
      {itemForm && <FormItem projeto={p} item={itemForm === "novo" ? undefined : itemForm} aoFechar={() => setItemForm(null)} />}
      {parcelasDe && (
        <FormParcelas
          projeto={p}
          item={parcelasDe}
          sugestao={resumoProjeto([parcelasDe], parcelas).faltaParcelar}
          aoFechar={() => setParcelasDe(null)}
        />
      )}
      {excluirItem && (
        <ModalExcluirRegra
          nome={excluirItem.descricao}
          origemId={excluirItem.id}
          excluir={async () => {
            checar(await supabase().from("projeto_itens").delete().eq("id", excluirItem.id));
          }}
          aoFechar={() => {
            setExcluirItem(null);
            setItemAberto(null);
          }}
        />
      )}
      {excluindo && (
        <Modal aberto aoFechar={() => setExcluindo(false)} titulo={`Excluir “${p.nome}”?`}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">
              Os itens serão excluídos. O que fazer com as parcelas ainda pendentes? As pagas ficam no histórico.
            </p>
            <Botao variante="perigo" onClick={() => excluirProjeto(true)}>
              Excluir e remover parcelas pendentes
            </Botao>
            <Botao variante="secundario" onClick={() => excluirProjeto(false)}>
              Excluir e manter as parcelas
            </Botao>
            <Botao variante="fantasma" onClick={() => setExcluindo(false)}>
              Cancelar
            </Botao>
          </div>
        </Modal>
      )}
      <ModalOcorrencia o={aberta} aoFechar={() => setAberta(null)} aoPagar={setPagando} />
      <ModalPagar o={pagando} aoFechar={() => setPagando(null)} />
    </>
  );
}

function Info({ rotulo, valor, destaque, sinal }: { rotulo: string; valor: number; destaque?: boolean; sinal?: boolean }) {
  return (
    <div>
      <p className="text-slate-500">{rotulo}</p>
      <Dinheiro valor={valor} sinal={sinal} className={destaque ? "text-lg font-semibold" : "font-semibold"} />
    </div>
  );
}

function ItemDetalhe({
  item,
  parcelas,
  aoEditar,
  aoParcelas,
  aoExcluir,
  aoAbrir,
  aoPagar,
}: {
  item: ProjetoItem;
  parcelas: Ocorrencia[];
  aoEditar: () => void;
  aoParcelas: () => void;
  aoExcluir: () => void;
  aoAbrir: (o: Ocorrencia) => void;
  aoPagar: (o: Ocorrencia) => void;
}) {
  const r = resumoProjeto([item], parcelas);
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-slate-500">Fornecedor</dt>
        <dd>{item.fornecedor || "—"}</dd>
        <dt className="text-slate-500">Tipo</dt>
        <dd>{item.tipo_item || "—"}</dd>
        <dt className="text-slate-500">Orçado</dt>
        <dd>{formatarReais(item.valor_orcado)}</dd>
        {item.contato && (
          <>
            <dt className="text-slate-500">Contato</dt>
            <dd className="break-words">{item.contato}</dd>
          </>
        )}
        {item.observacoes && (
          <>
            <dt className="text-slate-500">Observações</dt>
            <dd className="break-words">{item.observacoes}</dd>
          </>
        )}
      </dl>
      <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1">
          <dt className="text-slate-500">Contratado</dt>
          <dd className="text-right tabular-nums">{formatarReais(r.contratado)}</dd>
          <dt className="text-slate-500">Já pago antes do app</dt>
          <dd className="text-right tabular-nums">− {formatarReais(r.pagoAntes)}</dd>
          <dt className="text-slate-500">Parcelado</dt>
          <dd className="text-right tabular-nums">− {formatarReais(r.parcelado)}</dd>
          <dt className="border-t border-slate-200 pt-1 font-medium dark:border-slate-700">Falta parcelar</dt>
          <dd className="border-t border-slate-200 pt-1 text-right font-semibold tabular-nums dark:border-slate-700">
            {formatarReais(r.faltaParcelar)}
          </dd>
        </dl>
        {r.faltaParcelar > 0 && r.contratado > 0 && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            Ainda falta parcelar {formatarReais(r.faltaParcelar)}. Use “+ Parcelas” para lançar o restante.
          </p>
        )}
        {r.faltaParcelar < 0 && (
          <p className="mt-2 text-xs text-red-700 dark:text-red-300">
            As parcelas passam do contratado em {formatarReais(-r.faltaParcelar)}. Confira os valores.
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Pago até agora: {formatarReais(r.pago)} · falta pagar {formatarReais(r.faltaPagar)}
        </p>
      </div>
      <div>
        <Titulo
          acao={
            <Botao variante="fantasma" className="!min-h-9" onClick={aoParcelas}>
              <Plus className="size-4" /> Parcelas
            </Botao>
          }
        >
          Parcelas
        </Titulo>
        {parcelas.length === 0 ? (
          <p className="text-sm text-slate-500">
            Sem parcelas. Use “+ Parcelas” para lançar uma parcela avulsa, N iguais ou dividir até o evento.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {parcelas.map((o) => (
              <LinhaOcorrencia key={o.id} o={o} aoAbrir={() => aoAbrir(o)} aoPagar={() => aoPagar(o)} />
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-2">
        <Botao variante="secundario" className="flex-1" onClick={aoEditar}>
          Editar item
        </Botao>
        <Botao variante="fantasma" className="flex-1 text-red-600" onClick={aoExcluir}>
          Excluir item
        </Botao>
      </div>
    </div>
  );
}
