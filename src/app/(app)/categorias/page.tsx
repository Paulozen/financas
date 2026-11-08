"use client";

import clsx from "clsx";
import { Plus, Sparkles, Tags } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp, useCarregar } from "@/components/app-contexto";
import { Cabecalho, SeletorMes } from "@/components/cabecalho";
import { Abas, Botao, Campo, CampoValor, Cartao, Erro, formatarErro, Interruptor, Modal } from "@/components/ui";
import { carregarBaseGastos, gastosDaVisao } from "@/lib/analises-dados";
import { chaveIcone, ehEssencial, IconeCategoria, ICONES } from "@/lib/categorias-visual";
import { hojeISO, mesDe, somarMeses } from "@/lib/datas";
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
  const [sugerindo, setSugerindo] = useState(false);
  const { dados } = useCarregar("categorias", () => carregarBaseGastos(casa.id));

  // Total do mês por categoria (saídas com as faturas abertas nas compras).
  const totais = new Map<string | null, number>();
  // Média dos 3 meses completos anteriores, por categoria (para sugerir limites).
  const medias = new Map<string, number>();
  if (dados) {
    const { ocorrencias, gastos } = gastosDaVisao(dados, visao);
    const atual = mesDe(hojeISO());
    const ultimos = [1, 2, 3].map((i) => somarMeses(atual, -i));
    for (const g of gastos) if (g.categoria_id && ultimos.includes(g.mes)) medias.set(g.categoria_id, (medias.get(g.categoria_id) ?? 0) + g.valor / 3);
    if (tipo === "saida") for (const g of gastos) if (g.mes === mes) totais.set(g.categoria_id, (totais.get(g.categoria_id) ?? 0) + g.valor);
    if (tipo === "entrada")
      for (const o of ocorrencias)
        if (o.tipo === "entrada" && o.status !== "cancelado" && mesDe(o.vencimento) === mes)
          totais.set(o.categoria_id, (totais.get(o.categoria_id) ?? 0) + valorConta(o));
  }
  const lista = categorias.filter((c) => c.tipo === tipo);
  const total = [...totais.values()].reduce((s, v) => s + v, 0);
  const comLimite = tipo === "saida" ? lista.filter((c) => c.limite_mensal) : [];
  const totalLimites = comLimite.reduce((s, c) => s + (c.limite_mensal ?? 0), 0);
  const gastoComLimite = comLimite.reduce((s, c) => s + (totais.get(c.id) ?? 0), 0);

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
      {totalLimites > 0 && (
        <Cartao className="mb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-semibold">Orçamento do mês</span>
            <span className="text-xs text-slate-500">
              <span className="valor-oculto">{formatarReais(gastoComLimite)}</span> de <span className="valor-oculto">{formatarReais(totalLimites)}</span>
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={gastoComLimite > totalLimites ? "h-full rounded-full bg-red-500" : "h-full rounded-full bg-marca-500"}
              style={{ width: `${Math.min(100, (gastoComLimite / totalLimites) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {gastoComLimite <= totalLimites ? (
              <>
                Restam <span className="valor-oculto">{formatarReais(totalLimites - gastoComLimite)}</span> nas {comLimite.length} categorias com limite.
              </>
            ) : (
              <>
                <span className="valor-oculto">{formatarReais(gastoComLimite - totalLimites)}</span> acima dos limites.
              </>
            )}
          </p>
        </Cartao>
      )}
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
      <div className="mt-3 flex flex-wrap gap-2">
        {tipo === "saida" && medias.size > 0 && (
          <Botao variante="secundario" onClick={() => setSugerindo(true)}>
            <Sparkles className="size-4" aria-hidden /> Sugerir limites
          </Botao>
        )}
        <Link
          href="/categorizar"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Tags className="size-4" aria-hidden /> Gastos sem categoria
        </Link>
      </div>
      {sugerindo && <SugerirLimites medias={medias} aoFechar={() => setSugerindo(false)} />}
      {editando && <FormCategoria alvo={editando} aoFechar={() => setEditando(null)} />}
    </>
  );
}

/** Limites sugeridos pela média dos últimos 3 meses (arredondada para cima, de R$ 10 em R$ 10). */
function SugerirLimites({ medias, aoFechar }: { medias: Map<string, number>; aoFechar: () => void }) {
  const { categorias, atualizar } = useApp();
  const sugestoes = categorias
    .filter((c) => c.ativa && c.tipo === "saida" && (medias.get(c.id) ?? 0) >= 1000)
    .map((c) => ({ c, valor: Math.ceil((medias.get(c.id) ?? 0) / 1000) * 1000 }))
    .sort((a, b) => b.valor - a.valor);
  const [marcadas, setMarcadas] = useState(() => new Set(sugestoes.filter((s) => !s.c.limite_mensal).map((s) => s.c.id)));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function aplicar() {
    setSalvando(true);
    try {
      const sb = supabase();
      for (const s of sugestoes.filter((x) => marcadas.has(x.c.id)))
        checar(await sb.from("categorias").update({ limite_mensal: s.valor }).eq("id", s.c.id));
      await atualizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Sugerir limites">
      <p className="mb-3 text-sm text-slate-500">Pela média de gastos dos últimos 3 meses. Marque os que quer usar; dá para ajustar depois em cada categoria.</p>
      <ul className="mb-4 divide-y divide-slate-100 dark:divide-slate-800">
        {sugestoes.map(({ c, valor }) => (
          <li key={c.id}>
            <label className="flex min-h-12 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-marca-600"
                checked={marcadas.has(c.id)}
                onChange={(e) => {
                  const n = new Set(marcadas);
                  if (e.target.checked) n.add(c.id);
                  else n.delete(c.id);
                  setMarcadas(n);
                }}
              />
              <IconeCategoria categoria={c} tamanho="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.nome}</span>
                {c.limite_mensal ? <span className="text-xs text-slate-500">hoje: {formatarReais(c.limite_mensal)}</span> : null}
              </span>
              <span className="valor-oculto text-sm font-semibold whitespace-nowrap">{formatarReais(valor)}</span>
            </label>
          </li>
        ))}
      </ul>
      <Erro mensagem={erro} />
      <Botao className="w-full" carregando={salvando} disabled={!marcadas.size} onClick={aplicar}>
        Usar {marcadas.size} {marcadas.size === 1 ? "limite" : "limites"}
      </Botao>
    </Modal>
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
