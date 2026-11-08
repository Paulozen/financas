"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { useApp, useCarregar } from "@/components/app-contexto";
import { Cabecalho } from "@/components/cabecalho";
import { Cartao, Carregando, Dinheiro, Erro, formatarErro, Vazio } from "@/components/ui";
import { carregarBaseGastos, gastosDaVisao } from "@/lib/analises-dados";
import { IconeCategoria } from "@/lib/categorias-visual";
import { formatarData, hojeISO, mesDe, somarMeses } from "@/lib/datas";
import { checar } from "@/lib/db";
import { padraoDe } from "@/lib/importacao/sugestao";
import { supabase } from "@/lib/supabase";
import type { Gasto } from "@/lib/analises";

interface Grupo {
  padrao: string;
  descricao: string;
  itens: Gasto[];
  total: number;
}

/** Gastos sem categoria (compras do cartão e saídas) dos últimos 3 meses, agrupados pela descrição. */
export default function Categorizar() {
  const { casa, visao } = useApp();
  const { dados, erro, carregando, recarregar } = useCarregar("categorizar", () => carregarBaseGastos(casa.id));
  const desde = somarMeses(mesDe(hojeISO()), -2);

  if (!dados)
    return (
      <>
        <Cabecalho titulo="Categorizar" />
        {carregando ? <Carregando /> : <Erro mensagem={erro} />}
      </>
    );

  const { gastos } = gastosDaVisao(dados, visao);
  const grupos = new Map<string, Grupo>();
  for (const g of gastos) {
    if (!g.semCategoria || g.mes < desde || !g.ref) continue;
    const padrao = padraoDe(g);
    const grupo = grupos.get(padrao) ?? { padrao, descricao: g.descricao, itens: [], total: 0 };
    grupo.itens.push(g);
    grupo.total += g.valor;
    grupos.set(padrao, grupo);
  }
  const lista = [...grupos.values()].sort((a, b) => b.total - a.total);

  return (
    <>
      <Cabecalho titulo="Categorizar" />
      <p className="mb-4 text-sm text-slate-500">
        Gastos dos últimos 3 meses sem categoria, agrupados pela descrição. A categoria escolhida vale para todos do grupo e para os próximos
        com a mesma descrição.
      </p>
      {lista.length === 0 ? (
        <Vazio titulo="Tudo categorizado!" texto="Nenhum gasto sem categoria nos últimos 3 meses." />
      ) : (
        <Cartao>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {lista.map((g) => (
              <LinhaGrupo key={g.padrao} grupo={g} aoMudar={recarregar} />
            ))}
          </ul>
        </Cartao>
      )}
    </>
  );
}

function LinhaGrupo({ grupo, aoMudar }: { grupo: Grupo; aoMudar: () => void }) {
  const { casa, categorias, atualizar } = useApp();
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const opcoes = categorias.filter((c) => c.ativa && c.tipo === "saida");

  async function escolher(categoriaId: string) {
    if (!categoriaId) return;
    setErro(null);
    try {
      const sb = supabase();
      const compras = grupo.itens.filter((i) => i.origem === "cartao").map((i) => i.ref);
      const ocorrencias = grupo.itens.filter((i) => i.origem === "ocorrencia").map((i) => i.ref);
      if (compras.length) checar(await sb.from("transacoes_externas").update({ categoria_id: categoriaId }).in("id", compras));
      if (ocorrencias.length) checar(await sb.from("ocorrencias").update({ categoria_id: categoriaId }).in("id", ocorrencias));
      // Aprende para as próximas (cartão e caixa de entrada).
      checar(
        await sb
          .from("regras_importacao")
          .upsert(
            { casa_id: casa.id, padrao: grupo.padrao, acao: "novo", categoria_id: categoriaId, atualizado_em: new Date().toISOString() },
            { onConflict: "casa_id,padrao" },
          ),
      );
      setSalvo(true);
      await atualizar();
      aoMudar();
    } catch (e) {
      setErro(formatarErro(e));
    }
  }

  const ultimo = grupo.itens.reduce((a, b) => (a.data > b.data ? a : b));
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <IconeCategoria categoria={null} tamanho="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{grupo.descricao}</p>
          <p className="text-xs text-slate-500">
            {grupo.itens.length > 1 ? `${grupo.itens.length} vezes · última em ` : ""}
            {formatarData(ultimo.data)}
            {ultimo.origem === "cartao" && " · cartão"}
          </p>
        </div>
        <Dinheiro valor={grupo.total} className="text-sm font-bold" />
      </div>
      <div className="flex items-center gap-2 sm:w-56">
        <select
          aria-label={`Categoria de ${grupo.descricao}`}
          defaultValue=""
          onChange={(e) => escolher(e.target.value)}
          className="min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-sm dark:border-slate-700 dark:bg-slate-800/60"
        >
          <option value="">Escolher categoria…</option>
          {opcoes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        {salvo && <Check className="size-5 shrink-0 text-emerald-600" aria-label="Salvo" />}
      </div>
      <Erro mensagem={erro} />
    </li>
  );
}
