"use client";

import { FileUp } from "lucide-react";
import { useState } from "react";
import { useApp, useCarregar } from "@/components/app-contexto";
import { Cabecalho } from "@/components/cabecalho";
import { Mapeador } from "@/components/importar/mapeador";
import { Previa, type LinhaPrevia } from "@/components/importar/previa";
import { SeletorDono } from "@/components/ocorrencias";
import { Botao, Cartao, Erro, formatarErro, Titulo } from "@/components/ui";
import { formatarData, somarDias } from "@/lib/datas";
import { buscarTodos, checar } from "@/lib/db";
import {
  aplicarMapeamento,
  assinaturaCabecalho,
  calcularHashes,
  encontrarCabecalho,
  lerArquivo,
  PERFIS_PRONTOS,
  type Perfil,
  type TransacaoExtrato,
} from "@/lib/importacao/extrato";
import { padraoDe, sugerir, type RegraAprendida } from "@/lib/importacao/sugestao";
import { supabase } from "@/lib/supabase";
import type { Ocorrencia } from "@/lib/tipos";

type Etapa =
  | { tipo: "arquivo" }
  | { tipo: "mapear"; nome: string; linhas: string[][] }
  | { tipo: "previa"; nome: string; perfil: Perfil; linhas: LinhaPrevia[]; pendentes: Ocorrencia[]; descartadas: number }
  | { tipo: "concluido"; contagens: Record<string, number> };

interface Importacao {
  id: string;
  arquivo: string;
  perfil: string;
  contagens: Record<string, number>;
  criado_em: string;
}

export default function Importar() {
  const { casa, membro, membros, visao, atualizar } = useApp();
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "arquivo" });
  const [dono, setDono] = useState(visao === "casal" ? membro.id : visao);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);

  const historico = useCarregar(
    "importacoes",
    async () =>
      checar(
        await supabase()
          .from("importacoes")
          .select("id, arquivo, perfil, contagens, criado_em")
          .eq("casa_id", casa.id)
          .order("criado_em", { ascending: false })
          .limit(20),
      ) as Importacao[],
  );

  async function prepararPrevia(nome: string, perfil: Perfil, transacoes: TransacaoExtrato[], descartadas: number) {
    const conta = `${perfil.id}:${dono || "casal"}`;
    const hashes = await calcularHashes(conta, transacoes);
    const datas = transacoes.map((t) => t.data).sort();
    const [jaImportadas, regras, pendentes] = await Promise.all([
      buscarHashesExistentes(casa.id, hashes),
      buscarTodos<RegraAprendida>("regras_importacao", casa.id),
      datas.length
        ? buscarTodos<Ocorrencia>("ocorrencias", casa.id, (q) =>
            q
              .eq("status", "pendente")
              .gte("vencimento", somarDias(datas[0], -5))
              .lte("vencimento", somarDias(datas.at(-1)!, 5)),
          )
        : Promise.resolve([]),
    ]);
    const racha =
      casa.racha_ativo && casa.racha_membro_id && casa.racha_membro_id === dono
        ? { mensalidade: casa.racha_mensalidade, diaria: casa.racha_diaria }
        : null;
    const usados = new Set<string>();
    const linhas: LinhaPrevia[] = transacoes.map((t, i) => {
      const s = sugerir(t, { regras, pendentes: pendentes.filter((p) => !usados.has(p.id)), racha });
      if (s.vinculo_id) usados.add(s.vinculo_id);
      return {
        t,
        hash: hashes[i],
        jaImportada: jaImportadas.has(hashes[i]),
        acao: s.acao,
        categoria_id: s.categoria_id ?? "",
        dono: s.dono_membro_id === undefined ? dono : (s.dono_membro_id ?? ""),
        racha_tipo: s.racha_tipo ?? (t.valor < 0 ? "juiz" : "mensalidade"),
        vinculo_id: s.vinculo_id ?? "",
        motivo: s.motivo,
        padrao: padraoDe(t),
      };
    });
    setEtapa({ tipo: "previa", nome, perfil, linhas, pendentes, descartadas });
  }

  async function escolherArquivo(arquivo: File) {
    setErro(null);
    setLendo(true);
    try {
      const lido = await lerArquivo(arquivo.name, await arquivo.arrayBuffer());
      if (lido.formato === "ofx") {
        await prepararPrevia(
          arquivo.name,
          { id: "ofx", nome: "OFX", assinatura: "ofx", mapeamento: { cabecalho: 0, data: 0, descricao: [] } },
          lido.transacoes,
          0,
        );
        return;
      }
      if (!lido.linhas.length) throw new Error("Não encontrei dados neste arquivo.");
      const cab = encontrarCabecalho(lido.linhas);
      const assinatura = assinaturaCabecalho(lido.linhas[cab]);
      const salvos = checar(await supabase().from("perfis_importacao").select("*").eq("casa_id", casa.id)) as Perfil[];
      const perfil = [...PERFIS_PRONTOS, ...salvos].find((p) => p.assinatura === assinatura);
      if (!perfil) {
        setEtapa({ tipo: "mapear", nome: arquivo.name, linhas: lido.linhas });
        return;
      }
      const { transacoes, descartadas } = aplicarMapeamento(lido.linhas, { ...perfil.mapeamento, cabecalho: cab });
      await prepararPrevia(arquivo.name, perfil, transacoes, descartadas);
    } catch (e) {
      setErro(formatarErro(e));
    } finally {
      setLendo(false);
    }
  }

  return (
    <>
      <Cabecalho titulo="Importar extrato" semVisao />
      {etapa.tipo === "arquivo" && (
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
          <Cartao className="mb-4">
            <div className="flex flex-col gap-4">
              <SeletorDono rotulo="De quem é este extrato?" valor={dono} aoMudar={setDono} membros={membros} />
              <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-4 text-center hover:border-marca-500 dark:border-slate-700">
                <FileUp className="size-8 text-marca-600" aria-hidden />
                <span className="font-medium">{lendo ? "Lendo arquivo..." : "Escolher arquivo"}</span>
                <span className="text-xs text-slate-500">OFX, CSV ou XLSX</span>
                <input
                  type="file"
                  accept=".ofx,.csv,.xlsx,.txt"
                  className="sr-only"
                  disabled={lendo}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) escolherArquivo(f);
                  }}
                />
              </label>
              <Erro mensagem={erro} />
            </div>
          </Cartao>
          <Cartao>
            <Titulo>Importações anteriores</Titulo>
            {!historico.dados?.length ? (
              <p className="text-sm text-slate-500">Nenhuma ainda.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {historico.dados.map((h) => (
                  <li key={h.id} className="py-2">
                    <p className="truncate font-medium">{h.arquivo}</p>
                    <p className="text-xs text-slate-500">
                      {formatarData(h.criado_em.slice(0, 10))} · {resumoContagens(h.contagens)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      )}

      {etapa.tipo === "mapear" && (
        <Mapeador
          linhas={etapa.linhas}
          aoCancelar={() => setEtapa({ tipo: "arquivo" })}
          aoConcluir={async (perfil) => {
            try {
              const { transacoes, descartadas } = aplicarMapeamento(etapa.linhas, perfil.mapeamento);
              await prepararPrevia(etapa.nome, perfil, transacoes, descartadas);
            } catch (e) {
              setErro(formatarErro(e));
              setEtapa({ tipo: "arquivo" });
            }
          }}
        />
      )}

      {etapa.tipo === "previa" && (
        <Previa
          nome={etapa.nome}
          perfil={etapa.perfil}
          linhasIniciais={etapa.linhas}
          pendentes={etapa.pendentes}
          descartadas={etapa.descartadas}
          aoCancelar={() => setEtapa({ tipo: "arquivo" })}
          aoConfirmar={async (linhas) => {
            const contagens = checar(
              await supabase().rpc("confirmar_importacao", {
                p_casa: casa.id,
                p_membro: membro.id,
                p_arquivo: etapa.nome,
                p_perfil: etapa.perfil.nome,
                p_linhas: linhas,
              }),
            ) as Record<string, number>;
            await atualizar();
            setEtapa({ tipo: "concluido", contagens });
          }}
        />
      )}

      {etapa.tipo === "concluido" && (
        <Cartao>
          <Titulo>Importação concluída</Titulo>
          <p className="mb-4 text-sm">{resumoContagens(etapa.contagens)}</p>
          <Botao className="w-full" onClick={() => setEtapa({ tipo: "arquivo" })}>
            Importar outro arquivo
          </Botao>
        </Cartao>
      )}
    </>
  );
}

function resumoContagens(c: Record<string, number>): string {
  const partes = [
    c.novo && `${c.novo} novos`,
    c.vincular && `${c.vincular} vinculados`,
    c.racha && `${c.racha} no racha`,
    c.ignorar && `${c.ignorar} ignorados`,
    c.duplicadas && `${c.duplicadas} já importados`,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "nenhuma linha";
}

async function buscarHashesExistentes(casaId: string, hashes: string[]): Promise<Set<string>> {
  const existentes = new Set<string>();
  for (let i = 0; i < hashes.length; i += 80) {
    const parte = hashes.slice(i, i + 80);
    const dados = checar(await supabase().from("transacoes_importadas").select("hash").eq("casa_id", casaId).in("hash", parte)) as {
      hash: string;
    }[];
    for (const d of dados) existentes.add(d.hash);
  }
  return existentes;
}
