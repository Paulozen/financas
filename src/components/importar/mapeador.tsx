"use client";

import { useState } from "react";
import { checar } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { aplicarMapeamento, assinaturaCabecalho, encontrarCabecalho, sugerirMapeamento, type Mapeamento, type Perfil } from "@/lib/importacao/extrato";
import { supabase } from "@/lib/supabase";
import { formatarData } from "@/lib/datas";
import { useApp } from "../app-contexto";
import { Botao, Campo, Cartao, Erro, formatarErro, Interruptor, Selecao, Titulo } from "../ui";

/** Tela de mapeamento de colunas para um formato ainda desconhecido. Salva como perfil. */
export function Mapeador({
  linhas,
  aoCancelar,
  aoConcluir,
}: {
  linhas: string[][];
  aoCancelar: () => void;
  aoConcluir: (perfil: Perfil) => Promise<void>;
}) {
  const { casa } = useApp();
  const [m, setM] = useState<Mapeamento>(() => sugerirMapeamento(linhas, encontrarCabecalho(linhas)));
  const [modoValor, setModoValor] = useState<"valor" | "credito">(m.valor !== null && m.valor !== undefined ? "valor" : m.credito !== null ? "credito" : "valor");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const cab = linhas[m.cabecalho] ?? [];
  const colunas = cab.map((c, i) => ({ valor: String(i), rotulo: c || `Coluna ${i + 1}` }));
  const mapa: Mapeamento = modoValor === "valor" ? { ...m, credito: null, debito: null } : { ...m, valor: null };
  const previa = aplicarMapeamento(linhas, mapa);

  const num = (v: string) => (v === "" ? null : Number(v));
  const set = (k: keyof Mapeamento, v: unknown) => setM((x) => ({ ...x, [k]: v }));

  async function salvar() {
    setErro(null);
    if (!nome.trim()) return setErro("Dê um nome ao perfil (ex.: o nome do banco).");
    if (!previa.transacoes.length) return setErro("Nenhuma linha válida com esse mapeamento. Confira data e valor.");
    setSalvando(true);
    try {
      const assinatura = assinaturaCabecalho(cab);
      const salvo = checar(
        await supabase()
          .from("perfis_importacao")
          .upsert({ casa_id: casa.id, nome: nome.trim(), assinatura, mapeamento: mapa }, { onConflict: "casa_id,assinatura" })
          .select("*")
          .single(),
      ) as Perfil;
      await aoConcluir(salvo);
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  return (
    <Cartao>
      <Titulo>Formato novo: mapeie as colunas</Titulo>
      <p className="mb-4 text-sm text-slate-500">Na próxima vez, arquivos com este mesmo cabeçalho serão reconhecidos automaticamente.</p>
      <div className="flex flex-col gap-3">
        <Selecao
          rotulo="Linha do cabeçalho"
          value={String(m.cabecalho)}
          onChange={(e) => {
            const c = Number(e.target.value);
            setM(sugerirMapeamento(linhas, c));
          }}
          opcoes={linhas.slice(0, 30).map((l, i) => ({ valor: String(i), rotulo: `${i + 1}: ${l.join(" | ").slice(0, 60)}` }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Selecao rotulo="Data" value={String(m.data)} onChange={(e) => set("data", Number(e.target.value))} opcoes={colunas} />
          <Selecao rotulo="Hora (opcional)" value={m.hora == null ? "" : String(m.hora)} onChange={(e) => set("hora", num(e.target.value))} vazio="—" opcoes={colunas} />
          <Selecao rotulo="Descrição" value={String(m.descricao[0] ?? "")} onChange={(e) => set("descricao", [Number(e.target.value), ...m.descricao.slice(1)])} opcoes={colunas} />
          <Selecao
            rotulo="Descrição extra (opcional)"
            value={m.descricao[1] === undefined ? "" : String(m.descricao[1])}
            onChange={(e) => set("descricao", e.target.value === "" ? [m.descricao[0]] : [m.descricao[0], Number(e.target.value)])}
            vazio="—"
            opcoes={colunas}
          />
          <Selecao rotulo="Tipo do lançamento (opcional)" value={m.tipo == null ? "" : String(m.tipo)} onChange={(e) => set("tipo", num(e.target.value))} vazio="—" opcoes={colunas} />
        </div>
        <Selecao
          rotulo="Como vem o valor"
          value={modoValor}
          onChange={(e) => setModoValor(e.target.value as "valor" | "credito")}
          opcoes={[
            { valor: "valor", rotulo: "Uma coluna com sinal (negativo = saída)" },
            { valor: "credito", rotulo: "Colunas separadas de crédito e débito" },
          ]}
        />
        {modoValor === "valor" ? (
          <Selecao rotulo="Valor" value={m.valor == null ? "" : String(m.valor)} onChange={(e) => set("valor", num(e.target.value))} vazio="—" opcoes={colunas} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Selecao rotulo="Crédito" value={m.credito == null ? "" : String(m.credito)} onChange={(e) => set("credito", num(e.target.value))} vazio="—" opcoes={colunas} />
            <Selecao rotulo="Débito" value={m.debito == null ? "" : String(m.debito)} onChange={(e) => set("debito", num(e.target.value))} vazio="—" opcoes={colunas} />
          </div>
        )}
        <Interruptor rotulo="Inverter sinal (o extrato mostra saídas como positivas)" marcado={!!m.inverter} aoMudar={(v) => set("inverter", v)} />
        <Campo rotulo="Nome do perfil (banco)" placeholder="Ex.: Banco X - conta corrente" value={nome} onChange={(e) => setNome(e.target.value)} />

        <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
          <p className="mb-2 font-medium">
            Prévia: {previa.transacoes.length} linhas válidas{previa.descartadas ? `, ${previa.descartadas} ignoradas (sem data/valor)` : ""}
          </p>
          <ul className="flex flex-col gap-1">
            {previa.transacoes.slice(0, 5).map((t) => (
              <li key={t.indice} className="flex justify-between gap-2">
                <span className="truncate">
                  {formatarData(t.data)} · {t.descricao}
                </span>
                <span className="shrink-0 tabular-nums">{formatarReais(t.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
        <Erro mensagem={erro} />
        <Botao onClick={salvar} carregando={salvando}>
          Salvar perfil e continuar
        </Botao>
        <Botao variante="fantasma" onClick={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </Cartao>
  );
}
