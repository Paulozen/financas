"use client";

import clsx from "clsx";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useApp, useCarregar } from "@/components/app-contexto";
import { Cabecalho, SeletorMes } from "@/components/cabecalho";
import { Abas, Botao, Campo, CampoValor, Cartao, Erro, formatarErro, Interruptor, Modal } from "@/components/ui";
import { carregarBaseGastos, gastosDaVisao } from "@/lib/analises-dados";
import { chaveIcone, ehEssencial, IconeCategoria, ICONES } from "@/lib/categorias-visual";
import { mesDe } from "@/lib/datas";
import { checar } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { valorConta } from "@/lib/painel";
import { supabase } from "@/lib/supabase";
import type { Categoria, Tipo } from "@/lib/tipos";

const CORES = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#0ea5e9",
  "#a855f7",
  "#b45309",
  "#14b8a6",
  "#64748b",
  "#84cc16",
  "#f97316",
];

export default function Categorias() {
  const { casa, categorias, visao, mes } = useApp();
  const [tipo, setTipo] = useState<Tipo>("saida");
  const [editando, setEditando] = useState<Categoria | { nova: Tipo } | null>(null);
  const { dados } = useCarregar("categorias", () => carregarBaseGastos(casa.id));

  // Total do mês por categoria (saídas com as faturas abertas nas compras).
  const totais = new Map<string | null, number>();
  if (dados) {
    const { ocorrencias, gastos } = gastosDaVisao(dados, visao);
    if (tipo === "saida") for (const g of gastos) if (g.mes === mes) totais.set(g.categoria_id, (totais.get(g.categoria_id) ?? 0) + g.valor);
    if (tipo === "entrada")
      for (const o of ocorrencias)
        if (o.tipo === "entrada" && o.status !== "cancelado" && mesDe(o.vencimento) === mes)
          totais.set(o.categoria_id, (totais.get(o.categoria_id) ?? 0) + valorConta(o));
  }
  const lista = categorias.filter((c) => c.tipo === tipo);
  const total = [...totais.values()].reduce((s, v) => s + v, 0);

  return (
    <>
      <Cabecalho
        titulo="Categorias"
        acao={
          <button
            type="button"
            onClick={() => setEditando({ nova: tipo })}
            aria-label="Nova categoria"
            className="flex size-10 items-center justify-center rounded-full bg-white shadow-folha hover:bg-slate-50 dark:bg-slate-900 dark:shadow-none"
          >
            <Plus className="size-5" />
          </button>
        }
      />
      <div className="mx-auto max-w-xs">
        <Abas
          abas={[
            { valor: "saida", rotulo: "Saídas" },
            { valor: "entrada", rotulo: "Entradas" },
          ]}
          atual={tipo}
          aoMudar={setTipo}
        />
      </div>
      <SeletorMes />
      <div className="mb-2 flex justify-between px-1 text-sm">
        <span className="text-slate-500">Total do mês</span>
        <span className="valor-oculto font-bold">{formatarReais(total)}</span>
      </div>
      <Cartao>
        <ul className="grid grid-cols-3 gap-x-2 gap-y-5 min-[420px]:grid-cols-4 lg:grid-cols-6">
          {lista.map((c) => {
            const v = totais.get(c.id) ?? 0;
            const limite = tipo === "saida" ? c.limite_mensal : null;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setEditando(c)}
                  className={clsx("flex w-full flex-col items-center gap-1.5 text-center", !c.ativa && "opacity-40")}
                >
                  <AnelLimite parte={limite ? v / limite : null} cor={c.cor}>
                    <IconeCategoria categoria={c} tamanho="lg" />
                  </AnelLimite>
                  <span className="line-clamp-2 max-w-full text-xs font-semibold break-words">{c.nome}</span>
                  <span className="valor-oculto text-[11px] text-slate-500 tabular-nums">{v > 0 ? formatarReais(v) : " "}</span>
                  {limite ? <span className="-mt-1 text-[10px] text-slate-400">de {formatarReais(limite)}</span> : null}
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setEditando({ nova: tipo })} className="flex w-full flex-col items-center gap-1.5 text-center">
              <span className="flex size-14 items-center justify-center rounded-[1.15rem] border-2 border-dashed border-slate-300 text-slate-400 dark:border-slate-700">
                <Plus className="size-6" />
              </span>
              <span className="text-xs font-semibold text-slate-500">Criar</span>
            </button>
          </li>
        </ul>
      </Cartao>
      <p className="mt-3 px-1 text-xs text-slate-500">Toque numa categoria para mudar ícone, cor, limite mensal ou se é um gasto essencial.</p>
      {editando && <FormCategoria alvo={editando} aoFechar={() => setEditando(null)} />}
    </>
  );
}

/** Anel em volta do ícone mostrando quanto do limite mensal já foi usado. */
function AnelLimite({ parte, cor, children }: { parte: number | null; cor: string; children: React.ReactNode }) {
  if (parte === null) return <span className="p-1">{children}</span>;
  const r = 34;
  const comp = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, parte));
  const traco = parte > 1 ? "#dc2626" : parte >= 0.9 ? "#d97706" : cor;
  return (
    <span className="relative inline-flex p-1" title={`${Math.round(parte * 100)}% do limite`}>
      <svg viewBox="0 0 72 72" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-200 dark:text-slate-700" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={traco} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${p * comp} ${comp}`} />
      </svg>
      {children}
    </span>
  );
}

function FormCategoria({ alvo, aoFechar }: { alvo: Categoria | { nova: Tipo }; aoFechar: () => void }) {
  const { casa, categorias, atualizar } = useApp();
  const existente = "id" in alvo ? alvo : null;
  const [nome, setNome] = useState(existente?.nome ?? "");
  const [tipo, setTipo] = useState<Tipo>(existente?.tipo ?? ("nova" in alvo ? alvo.nova : "saida"));
  const [cor, setCor] = useState(existente?.cor ?? CORES[categorias.length % CORES.length]);
  const [icone, setIcone] = useState<string | null>(existente?.icone ?? null);
  const [limite, setLimite] = useState(existente?.limite_mensal ?? 0);
  const [essencial, setEssencial] = useState(ehEssencial(existente ?? { nome, essencial: null }));
  const [ativa, setAtiva] = useState(existente?.ativa ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const iconeAtual = icone ?? chaveIcone({ nome: nome || "outros", icone: null });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return setErro("Informe o nome.");
    setSalvando(true);
    try {
      const sb = supabase();
      // "Essencial" só fica gravado se for diferente do que o nome sugere (assim continua automático).
      const automatico = ehEssencial({ nome: nome.trim(), essencial: null });
      const campos = {
        nome: nome.trim(),
        cor,
        icone,
        limite_mensal: tipo === "saida" && limite > 0 ? limite : null,
        essencial: tipo === "saida" && essencial !== automatico ? essencial : null,
      };
      if (existente) checar(await sb.from("categorias").update({ ...campos, ativa }).eq("id", existente.id));
      else
        checar(
          await sb.from("categorias").insert({ ...campos, casa_id: casa.id, tipo, ordem: Math.max(0, ...categorias.map((c) => c.ordem)) + 1 }),
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
        <div className="flex items-end gap-3">
          <IconeCategoria categoria={{ nome: nome || "outros", icone: iconeAtual, cor }} tamanho="lg" />
          <div className="flex-1">
            <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus={!existente} />
          </div>
        </div>
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
                className="size-8 rounded-full ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-slate-900 dark:ring-offset-slate-900 dark:aria-pressed:ring-white"
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
            Ícone
            {icone && (
              <button type="button" onClick={() => setIcone(null)} className="text-xs font-normal text-marca-600 dark:text-marca-400">
                Automático pelo nome
              </button>
            )}
          </legend>
          <div className="grid max-h-44 grid-cols-7 gap-1.5 overflow-y-auto rounded-2xl bg-slate-50 p-2 dark:bg-slate-800/50">
            {Object.entries(ICONES).map(([chave, Icone]) => (
              <button
                key={chave}
                type="button"
                aria-label={`Ícone ${chave}`}
                aria-pressed={iconeAtual === chave}
                onClick={() => setIcone(chave)}
                className="flex aspect-square items-center justify-center rounded-xl text-slate-600 hover:bg-white aria-pressed:bg-white aria-pressed:shadow-sm aria-pressed:ring-2 dark:text-slate-300 dark:hover:bg-slate-900 dark:aria-pressed:bg-slate-900"
                style={iconeAtual === chave ? { color: cor, ["--tw-ring-color" as string]: cor } : undefined}
              >
                <Icone className="size-5" />
              </button>
            ))}
          </div>
        </fieldset>
        {tipo === "saida" && (
          <>
            <CampoValor rotulo="Limite mensal (opcional)" valor={limite} aoMudar={setLimite} dica="Mostra quanto do limite já foi usado e avisa quando passar. Zero = sem limite." />
            <Interruptor rotulo="Gasto essencial (desligue para contar como não essencial nas análises)" marcado={essencial} aoMudar={setEssencial} />
          </>
        )}
        {existente && <Interruptor rotulo="Ativa (aparece nos formulários)" marcado={ativa} aoMudar={setAtiva} />}
        <Erro mensagem={erro} />
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </form>
    </Modal>
  );
}
