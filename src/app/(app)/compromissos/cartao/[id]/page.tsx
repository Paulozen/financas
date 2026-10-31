"use client";

import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useApp, useCarregar } from "@/components/app-contexto";
import { Cartao, Carregando, Dinheiro, Erro, formatarErro, Selo, Titulo, Vazio } from "@/components/ui";
import type { ContaExterna } from "@/lib/caixa-entrada";
import { formatarData, hojeISO, mesDe, nomeMes, nomeMesCurto, somarMeses } from "@/lib/datas";
import { checar } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { padraoDe } from "@/lib/importacao/sugestao";
import { comprometidoPorMes, ehPagamentoDeFatura, gastosDaFatura, parcelasEmAberto, type CompraCartao } from "@/lib/pluggy/cartao";
import { supabase } from "@/lib/supabase";
import type { Cartao as TCartao } from "@/lib/tipos";

interface Compra extends CompraCartao {
  id: string;
  conta_externa_id: string;
}
interface Fatura {
  id: string;
  vencimento: string;
  valor: number;
  pago: number;
}

export default function DetalheCartao() {
  const { id } = useParams<{ id: string }>();
  const { nomeDono, nomeCategoria } = useApp();
  const [mesEscolhido, setMesEscolhido] = useState<string | null>(null);

  const { dados, erro, carregando, recarregar } = useCarregar(`cartao:${id}`, async () => {
    const sb = supabase();
    const cartao = checar(await sb.from("cartoes").select("*").eq("id", id).maybeSingle()) as TCartao | null;
    const contas = checar(await sb.from("contas_externas").select("*").eq("cartao_id", id)) as ContaExterna[];
    const ids = contas.map((c) => c.id);
    const [compras, faturas] = ids.length
      ? await Promise.all([
          sb
            .from("transacoes_externas")
            .select(
              "id, conta_externa_id, descricao, valor, data, data_compra, parcela_num, parcelas_total, fatura_mes, categoria_pluggy, categoria_id",
            )
            .in("conta_externa_id", ids)
            .order("data", { ascending: false })
            .then(checar),
          sb
            .from("faturas_externas")
            .select("id, vencimento, valor, pago")
            .in("conta_externa_id", ids)
            .order("vencimento", { ascending: false })
            .then(checar),
        ])
      : [[], []];
    return { cartao, contas, compras: compras as Compra[], faturas: faturas as Fatura[] };
  });

  if (carregando && !dados) return <Carregando />;
  if (erro) return <Erro mensagem={erro} />;
  const c = dados?.cartao;
  if (!c) return <p>Cartão não encontrado.</p>;
  const { contas, compras, faturas } = dados;

  const fechados = [...new Set(faturas.map((f) => mesDe(f.vencimento)))].sort();
  const aPartirDe = fechados.length && fechados.at(-1)! >= mesDe(hojeISO()) ? somarMeses(fechados.at(-1)!, 1) : mesDe(hojeISO());
  const parcelas = parcelasEmAberto(compras, aPartirDe);
  const comprometido = comprometidoPorMes(parcelas);
  const mesesComCompras = [...new Set(compras.map((x) => x.fatura_mes).filter((m): m is string => !!m && m <= aPartirDe))].sort();
  const mes = mesEscolhido ?? mesesComCompras.at(-1) ?? mesDe(hojeISO());
  const daFatura = compras.filter((x) => x.fatura_mes === mes);
  const porCategoria = gastosDaFatura(compras, mes);

  return (
    <>
      <Link href="/compromissos" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500">
        <ArrowLeft className="size-4" /> Compromissos
      </Link>
      <h1 className="mb-1 text-xl font-bold">{c.nome}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {nomeDono(c.dono_membro_id)} · vence dia {c.dia_vencimento}
        {contas.length ? ` · banco: ${contas.map((x) => x.nome).join(", ")}` : ""}
      </p>
      {!contas.length && (
        <div className="mb-4">
          <Vazio
            titulo="Cartão sem conta do banco vinculada"
            texto="Vincule este cartão a um cartão do Open Finance em Configurações → Bancos conectados para ver faturas, parcelas e compras."
          />
        </div>
      )}

      {contas.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <Cartao>
              <Titulo>Parcelas em aberto</Titulo>
              {!parcelas.length ? (
                <p className="text-sm text-slate-500">Nenhuma compra parcelada com parcelas por vir.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {parcelas.map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium" title={p.descricao}>
                          {p.descricao}
                        </p>
                        <p className="text-xs text-slate-500">
                          parcela {p.parcelaAtual}/{p.total} · {formatarReais(p.valorParcela)} por mês
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] text-slate-500">falta</p>
                        <Dinheiro valor={p.falta} className="font-semibold" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>

            {comprometido.size > 0 && (
              <Cartao>
                <Titulo>Comprometido por mês (parcelas)</Titulo>
                <ul className="flex flex-col gap-1 text-sm">
                  {[...comprometido.entries()].map(([m, v]) => (
                    <li key={m} className="flex justify-between">
                      <span className="first-letter:uppercase">{nomeMesCurto(m)}</span>
                      <Dinheiro valor={v} />
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  A previsão das faturas futuras soma essas parcelas à média das compras à vista dos últimos 3 meses.
                </p>
              </Cartao>
            )}

            <Cartao>
              <Titulo>Faturas do banco</Titulo>
              {!faturas.length ? (
                <p className="text-sm text-slate-500">O banco não enviou faturas deste cartão.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {faturas.slice(0, 8).map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span>Vence {formatarData(f.vencimento)}</span>
                      <span className="flex items-center gap-2">
                        {f.pago >= f.valor && f.valor > 0 && <Selo cor="verde">paga</Selo>}
                        <Dinheiro valor={f.valor} className="font-medium" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </div>

          <Cartao>
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                aria-label="Fatura anterior"
                onClick={() => setMesEscolhido(somarMeses(mes, -1))}
                className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="size-5" />
              </button>
              <h2 className="font-semibold first-letter:uppercase">Compras da fatura de {nomeMes(mes)}</h2>
              <button
                type="button"
                aria-label="Próxima fatura"
                onClick={() => setMesEscolhido(somarMeses(mes, 1))}
                className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
            {porCategoria.length > 0 && (
              <p className="mb-2 text-xs text-slate-500">
                {porCategoria.map((g) => `${nomeCategoria(g.categoria_id)} ${formatarReais(g.total)}`).join(" · ")}
              </p>
            )}
            {!daFatura.length ? (
              <p className="text-sm text-slate-500">Nenhuma compra nesta fatura.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {daFatura.map((x) => (
                  <LinhaCompra key={x.id} compra={x} aoMudar={recarregar} />
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      )}
    </>
  );
}

function LinhaCompra({ compra, aoMudar }: { compra: Compra; aoMudar: () => void }) {
  const { casa, categorias } = useApp();
  const [erroLinha, setErroLinha] = useState<string | null>(null);
  const pagamento = ehPagamentoDeFatura(compra);
  async function mudarCategoria(categoriaId: string) {
    try {
      const sb = supabase();
      checar(
        await sb
          .from("transacoes_externas")
          .update({ categoria_id: categoriaId || null })
          .eq("id", compra.id),
      );
      // Aprende: próximas compras com a mesma descrição ganham a mesma categoria.
      if (categoriaId)
        checar(
          await sb.from("regras_importacao").upsert(
            {
              casa_id: casa.id,
              padrao: padraoDe(compra),
              acao: "novo",
              categoria_id: categoriaId,
              atualizado_em: new Date().toISOString(),
            },
            { onConflict: "casa_id,padrao" },
          ),
        );
      aoMudar();
    } catch (e) {
      setErroLinha(formatarErro(e));
    }
  }
  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{compra.descricao}</p>
          <p className="text-xs text-slate-500">
            {formatarData(compra.data)}
            {compra.parcelas_total && compra.parcelas_total > 1 ? ` · parcela ${compra.parcela_num}/${compra.parcelas_total}` : ""}
          </p>
        </div>
        <Dinheiro valor={-compra.valor} sinal className="shrink-0 text-sm font-semibold" />
      </div>
      {!pagamento && compra.valor > 0 && (
        <select
          aria-label={`Categoria de ${compra.descricao}`}
          value={compra.categoria_id ?? ""}
          onChange={(e) => mudarCategoria(e.target.value)}
          className="min-h-9 w-fit rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">Sem categoria</option>
          {categorias
            .filter((k) => k.ativa && k.tipo === "saida")
            .map((k) => (
              <option key={k.id} value={k.id}>
                {k.nome}
              </option>
            ))}
        </select>
      )}
      <Erro mensagem={erroLinha} />
    </li>
  );
}
