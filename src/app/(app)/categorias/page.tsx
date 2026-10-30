"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-contexto";
import { Cabecalho } from "@/components/cabecalho";
import { Abas, Botao, Campo, Cartao, Erro, formatarErro, Interruptor, Modal, Selo, Titulo } from "@/components/ui";
import { checar } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { Categoria, Tipo } from "@/lib/tipos";

const CORES = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#0ea5e9", "#a855f7", "#b45309", "#14b8a6", "#64748b", "#84cc16", "#f97316"];

export default function Categorias() {
  const { categorias } = useApp();
  const [editando, setEditando] = useState<Categoria | { nova: Tipo } | null>(null);

  const grupo = (tipo: Tipo, titulo: string) => (
    <Cartao className="mb-4">
      <Titulo
        acao={
          <Botao variante="fantasma" className="!min-h-9" onClick={() => setEditando({ nova: tipo })}>
            <Plus className="size-4" /> Nova
          </Botao>
        }
      >
        {titulo}
      </Titulo>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {categorias
          .filter((c) => c.tipo === tipo)
          .map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setEditando(c)} className="flex min-h-12 w-full items-center gap-3 text-left">
                <span className="size-4 rounded-full" style={{ background: c.cor }} aria-hidden />
                <span className={c.ativa ? "flex-1" : "flex-1 text-slate-400 line-through"}>{c.nome}</span>
                {!c.ativa && <Selo>desativada</Selo>}
              </button>
            </li>
          ))}
      </ul>
    </Cartao>
  );

  return (
    <>
      <Cabecalho titulo="Categorias" semVisao />
      {grupo("saida", "Saídas")}
      {grupo("entrada", "Entradas")}
      {editando && <FormCategoria alvo={editando} aoFechar={() => setEditando(null)} />}
    </>
  );
}

function FormCategoria({ alvo, aoFechar }: { alvo: Categoria | { nova: Tipo }; aoFechar: () => void }) {
  const { casa, categorias, atualizar } = useApp();
  const existente = "id" in alvo ? alvo : null;
  const [nome, setNome] = useState(existente?.nome ?? "");
  const [tipo, setTipo] = useState<Tipo>(existente?.tipo ?? ("nova" in alvo ? alvo.nova : "saida"));
  const [cor, setCor] = useState(existente?.cor ?? CORES[categorias.length % CORES.length]);
  const [ativa, setAtiva] = useState(existente?.ativa ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return setErro("Informe o nome.");
    setSalvando(true);
    try {
      const sb = supabase();
      if (existente) checar(await sb.from("categorias").update({ nome: nome.trim(), cor, ativa }).eq("id", existente.id));
      else
        checar(
          await sb
            .from("categorias")
            .insert({ casa_id: casa.id, nome: nome.trim(), tipo, cor, ordem: Math.max(0, ...categorias.map((c) => c.ordem)) + 1 }),
        );
      await atualizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={existente ? "Editar categoria" : "Nova categoria"}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        {!existente && (
          <Abas
            abas={[
              { valor: "saida", rotulo: "Saída" },
              { valor: "entrada", rotulo: "Entrada" },
            ]}
            atual={tipo}
            aoMudar={setTipo}
          />
        )}
        <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Cor</legend>
          <div className="flex flex-wrap gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor ${c}`}
                aria-pressed={cor === c}
                onClick={() => setCor(c)}
                className="size-9 rounded-full ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-slate-900 dark:ring-offset-slate-900 dark:aria-pressed:ring-white"
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
        {existente && <Interruptor rotulo="Ativa (aparece nos formulários)" marcado={ativa} aoMudar={setAtiva} />}
        <Erro mensagem={erro} />
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </form>
    </Modal>
  );
}
