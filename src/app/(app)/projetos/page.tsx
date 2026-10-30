"use client";

import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { daVisao, useApp, useCarregar } from "@/components/app-contexto";
import { Cabecalho } from "@/components/cabecalho";
import { FormProjeto } from "@/components/form-projetos";
import { Barra, Botao, Cartao, Carregando, Erro, Selo, Vazio } from "@/components/ui";
import { formatarData } from "@/lib/datas";
import { buscarTodos } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { resumoProjeto } from "@/lib/projetos";
import type { Ocorrencia, Projeto, ProjetoItem } from "@/lib/tipos";

export default function Projetos() {
  const { casa, visao } = useApp();
  const [novo, setNovo] = useState(false);
  const { dados, erro, carregando } = useCarregar("projetos", async () => {
    const [projetos, itens, parcelas] = await Promise.all([
      buscarTodos<Projeto>("projetos", casa.id, undefined, "data_evento"),
      buscarTodos<ProjetoItem>("projeto_itens", casa.id),
      buscarTodos<Ocorrencia>("ocorrencias", casa.id, (q) => q.eq("origem_tipo", "parcela_projeto")),
    ]);
    return { projetos, itens, parcelas };
  });
  const projetos = daVisao(dados?.projetos ?? [], visao);

  return (
    <>
      <Cabecalho titulo="Projetos" />
      <Botao className="mb-4 w-full lg:w-auto" onClick={() => setNovo(true)}>
        <Plus className="size-4" /> Novo projeto
      </Botao>
      <Erro mensagem={erro} />
      {carregando && !dados ? (
        <Carregando />
      ) : projetos.length === 0 ? (
        <Vazio titulo="Nenhum projeto" texto="Crie o projeto do casamento para acompanhar fornecedores, contratos e parcelas." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {projetos.map((p) => {
            const itens = dados!.itens.filter((i) => i.projeto_id === p.id);
            const r = resumoProjeto(itens, dados!.parcelas);
            return (
              <Link key={p.id} href={`/projetos/${p.id}`}>
                <Cartao className="hover:border-emerald-400">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.nome}</p>
                      <p className="text-xs text-slate-500">
                        {p.data_evento ? formatarData(p.data_evento) : "sem data"} · {itens.length} itens
                      </p>
                    </div>
                    {p.status !== "ativo" ? (
                      <Selo>{p.status === "concluido" ? "concluído" : "cancelado"}</Selo>
                    ) : (
                      <ChevronRight className="size-4 text-slate-400" />
                    )}
                  </div>
                  <Barra valor={r.pago} total={r.contratado} />
                  <p className="mt-1 text-xs text-slate-500">
                    Pago {formatarReais(r.pago)} de {formatarReais(r.contratado)} contratado · orçamento {formatarReais(p.orcamento)}
                  </p>
                </Cartao>
              </Link>
            );
          })}
        </div>
      )}
      {novo && <FormProjeto aoFechar={() => setNovo(false)} />}
    </>
  );
}
