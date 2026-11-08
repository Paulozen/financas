"use client";

import clsx from "clsx";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { useApp, useCarregar } from "@/components/app-contexto";
import { Cabecalho } from "@/components/cabecalho";
import { Botao, Campo, Cartao, Carregando, Erro, formatarErro, Interruptor, Modal, Selecao, Selo, Vazio } from "@/components/ui";
import { formatarData, hojeISO, somarDias } from "@/lib/datas";
import { buscarTodos, checar } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { ehPagamentoDeFatura } from "@/lib/pluggy/cartao";
import {
  aplicarRegras,
  bateRegra,
  OPS_TEXTO,
  OPS_VALOR,
  ROTULO_OP,
  validarRegra,
  type CampoRegra,
  type Condicao,
  type OpRegra,
  type Regra,
} from "@/lib/regras";
import { supabase } from "@/lib/supabase";

interface Transacao {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  situacao: string;
  categoria_id: string | null;
  categoria_pluggy: string | null;
}

/** Valor como as regras veem: entrada positiva, saída negativa (compras do cartão são saídas). */
const movimento = (t: Transacao) => ({ descricao: t.descricao, valor: t.situacao === "cartao" ? -t.valor : t.valor });

export default function Regras() {
  const { casa, categorias, atualizar } = useApp();
  const [editando, setEditando] = useState<Regra | "nova" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const { dados, carregando, recarregar } = useCarregar("regras", async () => {
    const [regras, transacoes] = await Promise.all([
      buscarTodos<Regra>("regras", casa.id, undefined, "prioridade"),
      buscarTodos<Transacao>("transacoes_externas", casa.id, (q) => q.gte("data", somarDias(hojeISO(), -120)), "data"),
    ]);
    return { regras, transacoes };
  });
  const nomeCat = (id: string | null) => categorias.find((c) => c.id === id)?.nome ?? "";

  /** Aplica as regras às compras do cartão sem categoria (a caixa de entrada já usa as regras sozinha). */
  async function aplicarAgora() {
    setErro(null);
    setAviso(null);
    try {
      const validas = new Set(categorias.filter((c) => c.ativa).map((c) => c.id));
      const semCategoria = (dados?.transacoes ?? []).filter((t) => t.situacao === "cartao" && !t.categoria_id && t.valor > 0 && !ehPagamentoDeFatura(t));
      const porCategoria = new Map<string, string[]>();
      for (const t of semCategoria) {
        const r = aplicarRegras(dados?.regras ?? [], movimento(t), validas);
        if (r?.categoria_id) porCategoria.set(r.categoria_id, [...(porCategoria.get(r.categoria_id) ?? []), t.id]);
      }
      let n = 0;
      for (const [cat, ids] of porCategoria) {
        checar(await supabase().from("transacoes_externas").update({ categoria_id: cat }).in("id", ids));
        n += ids.length;
      }
      setAviso(n ? `${n} ${n === 1 ? "compra do cartão categorizada" : "compras do cartão categorizadas"}.` : "Nenhuma compra sem categoria bateu com as regras.");
      await atualizar();
      recarregar();
    } catch (e) {
      setErro(formatarErro(e));
    }
  }

  async function alternar(r: Regra) {
    try {
      checar(await supabase().from("regras").update({ ativa: !r.ativa }).eq("id", r.id));
      recarregar();
    } catch (e) {
      setErro(formatarErro(e));
    }
  }

  return (
    <>
      <Cabecalho
        titulo="Regras"
        semVisao
        acao={
          <button
            type="button"
            onClick={() => setEditando("nova")}
            aria-label="Nova regra"
            className="flex size-10 items-center justify-center rounded-full bg-white shadow-folha hover:bg-slate-50 dark:bg-slate-900 dark:shadow-none"
          >
            <Plus className="size-5" />
          </button>
        }
      />
      <p className="mb-4 text-sm text-slate-500">
        Regras escritas por vocês: valem na caixa de entrada e nas compras do cartão, antes do pacote de lojas e da categoria do banco. Ex.:
        “descrição contém PIX ENVIADO FULANO” → categoria Casa, descrição “Diarista”.
      </p>
      <Erro mensagem={erro} />
      {aviso && <p className="mb-3 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{aviso}</p>}
      {carregando && !dados ? (
        <Carregando />
      ) : !dados?.regras.length ? (
        <Vazio
          titulo="Nenhuma regra ainda"
          texto="As categorias que vocês escolhem na caixa de entrada já viram regras aprendidas. Aqui vocês criam regras mais amplas (contém, começa com, faixa de valor…)."
          acao={<Botao onClick={() => setEditando("nova")}>Criar regra</Botao>}
        />
      ) : (
        <>
          <Cartao>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {dados.regras.map((r) => {
                const batem = dados.transacoes.filter((t) => bateRegra(r, movimento(t))).length;
                return (
                  <li key={r.id} className={clsx("flex items-center gap-3 py-3", !r.ativa && "opacity-50")}>
                    <button type="button" onClick={() => setEditando(r)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold">{r.nome}</p>
                      <p className="truncate text-xs text-slate-500">
                        {resumo(r)} →{" "}
                        {[r.ignorar && "ignorar", r.categoria_id && nomeCat(r.categoria_id), r.nova_descricao && `“${r.nova_descricao}”`].filter(Boolean).join(", ")}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        prioridade {r.prioridade} · bate com {batem} {batem === 1 ? "transação" : "transações"} dos últimos 4 meses
                      </p>
                    </button>
                    <input
                      type="checkbox"
                      aria-label={r.ativa ? `Desligar ${r.nome}` : `Ligar ${r.nome}`}
                      checked={r.ativa}
                      onChange={() => alternar(r)}
                      className="size-5 accent-marca-600"
                    />
                  </li>
                );
              })}
            </ul>
          </Cartao>
          <Botao variante="secundario" className="mt-3" onClick={aplicarAgora}>
            <Wand2 className="size-4" aria-hidden /> Aplicar às compras do cartão sem categoria
          </Botao>
        </>
      )}
      {editando && (
        <FormRegra
          regra={editando === "nova" ? undefined : editando}
          transacoes={dados?.transacoes ?? []}
          proximaPrioridade={Math.max(0, ...(dados?.regras ?? []).map((r) => r.prioridade)) + 10}
          aoFechar={() => {
            setEditando(null);
            recarregar();
          }}
        />
      )}
    </>
  );
}

function resumo(r: Regra): string {
  const folhas = r.condicoes.flatMap((c) => ("condicoes" in c ? c.condicoes : [c]));
  return folhas
    .map((c) => `${c.campo === "valor" ? "valor" : "descrição"} ${ROTULO_OP[c.op]} ${c.campo === "valor" ? c.valor : `“${c.valor}”`}`)
    .join(r.operador === "or" ? " ou " : " e ");
}

function FormRegra({
  regra,
  transacoes,
  proximaPrioridade,
  aoFechar,
}: {
  regra?: Regra;
  transacoes: Transacao[];
  proximaPrioridade: number;
  aoFechar: () => void;
}) {
  const { casa, categorias } = useApp();
  const [nome, setNome] = useState(regra?.nome ?? "");
  const [operador, setOperador] = useState<"and" | "or">(regra?.operador ?? "and");
  const [condicoes, setCondicoes] = useState<Condicao[]>(
    () => (regra?.condicoes.flatMap((c) => ("condicoes" in c ? c.condicoes : [c])) as Condicao[]) ?? [{ campo: "descricao", op: "contem", valor: "" }],
  );
  const [categoria, setCategoria] = useState(regra?.categoria_id ?? "");
  const [ignorar, setIgnorar] = useState(regra?.ignorar ?? false);
  const [novaDescricao, setNovaDescricao] = useState(regra?.nova_descricao ?? "");
  const [prioridade, setPrioridade] = useState(String(regra?.prioridade ?? proximaPrioridade));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const rascunho = { operador, condicoes: condicoes.filter((c) => c.valor.trim()) };
  const batem = rascunho.condicoes.length ? transacoes.filter((t) => bateRegra(rascunho, movimento(t))) : [];
  const mudar = (i: number, c: Partial<Condicao>) => setCondicoes(condicoes.map((x, j) => (j === i ? { ...x, ...c } : x)));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const dados = {
      nome: nome.trim(),
      operador,
      condicoes: condicoes.filter((c) => c.valor.trim()),
      categoria_id: categoria || null,
      ignorar,
      nova_descricao: novaDescricao.trim() || null,
      prioridade: Number(prioridade) || 100,
    };
    const problema = validarRegra(dados);
    if (problema) return setErro(problema);
    setSalvando(true);
    try {
      const sb = supabase();
      if (regra) checar(await sb.from("regras").update(dados).eq("id", regra.id));
      else checar(await sb.from("regras").insert({ ...dados, casa_id: casa.id }));
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!regra || !confirm(`Excluir a regra “${regra.nome}”?`)) return;
    try {
      checar(await supabase().from("regras").delete().eq("id", regra.id));
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={regra ? "Editar regra" : "Nova regra"}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Campo rotulo="Nome" placeholder="Ex.: Diarista" value={nome} onChange={(e) => setNome(e.target.value)} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 flex w-full items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
            Quando
            {condicoes.length > 1 && (
              <select
                aria-label="Juntar condições"
                value={operador}
                onChange={(e) => setOperador(e.target.value as "and" | "or")}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="and">todas valem (E)</option>
                <option value="or">qualquer uma vale (OU)</option>
              </select>
            )}
          </legend>
          {condicoes.map((c, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 rounded-2xl bg-slate-50 p-2 dark:bg-slate-800/50">
              <select
                aria-label="Campo"
                value={c.campo}
                onChange={(e) => {
                  const campo = e.target.value as CampoRegra;
                  mudar(i, { campo, op: campo === "valor" ? "menor" : "contem" });
                }}
                className="min-h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="descricao">Descrição</option>
                <option value="valor">Valor (R$)</option>
              </select>
              <select
                aria-label="Comparação"
                value={c.op}
                onChange={(e) => mudar(i, { op: e.target.value as OpRegra })}
                className="min-h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {(c.campo === "valor" ? OPS_VALOR : OPS_TEXTO).map((op) => (
                  <option key={op} value={op}>
                    {ROTULO_OP[op]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Remover condição"
                disabled={condicoes.length === 1}
                onClick={() => setCondicoes(condicoes.filter((_, j) => j !== i))}
                className="row-span-2 flex items-center justify-center rounded-xl px-2 text-slate-400 hover:text-red-600 disabled:opacity-30"
              >
                <Trash2 className="size-4" />
              </button>
              <input
                aria-label="Valor da condição"
                value={c.valor}
                onChange={(e) => mudar(i, { valor: e.target.value })}
                placeholder={c.campo === "valor" ? "Ex.: -100,00 (saída é negativa)" : "Ex.: IFOOD"}
                className="col-span-2 min-h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          ))}
          <Botao variante="fantasma" className="!min-h-9 self-start" onClick={() => setCondicoes([...condicoes, { campo: "descricao", op: "contem", valor: "" }])}>
            <Plus className="size-4" /> Condição
          </Botao>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Então</legend>
          <Selecao
            rotulo="Categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            vazio="— não mudar —"
            opcoes={categorias.filter((c) => c.ativa).map((c) => ({ valor: c.id, rotulo: `${c.nome} (${c.tipo === "saida" ? "saída" : "entrada"})` }))}
          />
          <Campo rotulo="Trocar a descrição para (opcional)" placeholder="Ex.: Diarista" value={novaDescricao} onChange={(e) => setNovaDescricao(e.target.value)} />
          <Interruptor rotulo="Ignorar (não vira lançamento na caixa de entrada)" marcado={ignorar} aoMudar={setIgnorar} />
          <Campo rotulo="Prioridade (menor roda primeiro)" type="number" inputMode="numeric" value={prioridade} onChange={(e) => setPrioridade(e.target.value)} />
        </fieldset>

        <div className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
          <p className="font-medium">
            Prévia: <Selo cor={batem.length ? "azul" : "slate"}>{batem.length}</Selo> {batem.length === 1 ? "transação bate" : "transações batem"} (últimos 4 meses)
          </p>
          {batem.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
              {batem.slice(0, 5).map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {formatarData(t.data)} · {t.descricao}
                  </span>
                  <span className="valor-oculto shrink-0 tabular-nums">{formatarReais(movimento(t).valor)}</span>
                </li>
              ))}
              {batem.length > 5 && <li className="text-slate-400">e mais {batem.length - 5}…</li>}
            </ul>
          )}
          {batem.length > 40 && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Bate com muita coisa — confira se a condição não está ampla demais.</p>}
        </div>

        <Erro mensagem={erro} />
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
        {regra && (
          <Botao variante="fantasma" className="text-red-600" onClick={excluir}>
            Excluir
          </Botao>
        )}
      </form>
    </Modal>
  );
}
