"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  aceitaEstimativa,
  ajustarPrevisto,
  cancelarOcorrencia,
  desfazerPagamento,
  excluirOcorrencia,
  marcarComReserva,
  pagar,
} from "@/lib/acoes";
import { formatarData, hojeISO } from "@/lib/datas";
import { checar } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { supabase } from "@/lib/supabase";
import { IconeCategoria } from "@/lib/categorias-visual";
import type { Ocorrencia } from "@/lib/tipos";
import { useApp } from "./app-contexto";
import { AreaTexto, Botao, Campo, CampoValor, Dinheiro, Erro, formatarErro, Interruptor, Modal, Selo } from "./ui";

export const ROTULO_ORIGEM: Record<Ocorrencia["origem_tipo"], string> = {
  recorrencia: "Recorrente",
  pontual: "Pontual",
  parcela_contrato: "Parcela",
  pagamento_divida: "Pagamento de dívida",
  meta_divida: "Meta de dívida",
  parcela_projeto: "Parcela de projeto",
  fatura: "Fatura",
};

import { valorConta as valorEfetivo } from "@/lib/painel";

export { valorEfetivo };

export function SeloStatus({ o }: { o: Ocorrencia }) {
  if (o.status === "pago") return <Selo cor="verde">Pago</Selo>;
  if (o.status === "cancelado") return <Selo>Cancelado</Selo>;
  if (o.vencimento < hojeISO()) return <Selo cor="vermelho">Atrasado</Selo>;
  return <Selo cor="amarelo">Pendente</Selo>;
}

export function LinhaOcorrencia({ o, aoAbrir, aoPagar }: { o: Ocorrencia; aoAbrir: () => void; aoPagar: () => void }) {
  const { nomeDono, nomeCategoria, categorias } = useApp();
  return (
    <li className="flex items-center gap-2 py-2.5 min-[400px]:gap-3">
      <IconeCategoria categoria={categorias.find((c) => c.id === o.categoria_id)} tamanho="sm" className={clsx("hidden min-[400px]:inline-flex", o.status === "cancelado" && "opacity-50")} />
      <button type="button" onClick={aoAbrir} className="flex min-w-0 flex-1 flex-col items-start text-left">
        <span className={clsx("line-clamp-2 max-w-full font-medium break-words", o.status === "cancelado" && "line-through opacity-60")}>
          {o.descricao}
        </span>
        <span className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
          {formatarData(o.vencimento)} · {nomeCategoria(o.categoria_id)} · {nomeDono(o.dono_membro_id)} <SeloStatus o={o} />
          {o.paga_com_reserva && <Selo cor="azul">dinheiro guardado</Selo>}
        </span>
      </button>
      <div className="flex flex-col items-end">
        <Dinheiro
          valor={o.tipo === "saida" ? -valorEfetivo(o) : valorEfetivo(o)}
          sinal
          className={clsx("text-sm font-semibold", o.status === "cancelado" && "line-through opacity-60")}
        />
        {o.status === "pago" && o.valor_real !== o.valor_previsto && (
          <span className="text-[11px] text-slate-500">prev. {formatarReais(o.valor_previsto)}</span>
        )}
      </div>
      {o.status === "pendente" && (
        <Botao variante="secundario" className="!min-h-9 shrink-0 !px-2.5 sm:!px-3" onClick={aoPagar} aria-label={`Pagar ${o.descricao}`}>
          <Check className="size-4" aria-hidden />
          <span className="hidden sm:inline">Pagar</span>
        </Botao>
      )}
    </li>
  );
}

/** Modal "Marcar como pago". */
export function ModalPagar({ o, aoFechar }: { o: Ocorrencia | null; aoFechar: () => void }) {
  if (!o) return null;
  return <FormPagar key={o.id} o={o} aoFechar={aoFechar} />;
}

function FormPagar({ o, aoFechar }: { o: Ocorrencia; aoFechar: () => void }) {
  const { sincronizar } = useApp();
  const [valor, setValor] = useState(o.valor_previsto);
  const [data, setData] = useState(hojeISO());
  const [obs, setObs] = useState(o.observacao ?? "");
  const [estimativa, setEstimativa] = useState(false);
  const [comReserva, setComReserva] = useState(!!o.paga_com_reserva);
  const [modo, setModo] = useState<"fixa" | "variavel" | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (o.origem_tipo !== "recorrencia" || !o.origem_id) return;
    supabase()
      .from("recorrencias")
      .select("modo")
      .eq("id", o.origem_id)
      .maybeSingle()
      .then(({ data }) => setModo(data?.modo));
  }, [o.origem_tipo, o.origem_id]);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await pagar(o, { valor, data, observacao: obs, usarComoEstimativa: estimativa, comReserva: o.tipo === "saida" && comReserva });
      await sincronizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Marcar como pago">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {o.descricao} · vence {formatarData(o.vencimento)}
        </p>
        <CampoValor rotulo="Valor pago" valor={valor} aoMudar={setValor} autoFocus dica={`Previsto: ${formatarReais(o.valor_previsto)}`} />
        <Campo rotulo="Data do pagamento" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <AreaTexto rotulo="Observação" value={obs} onChange={(e) => setObs(e.target.value)} />
        {o.tipo === "saida" && (
          <div>
            <Interruptor rotulo="Pago com dinheiro guardado (caixinha/reserva)" marcado={comReserva} aoMudar={setComReserva} />
            <p className="text-xs text-slate-500">Continua na categoria e no projeto, mas não pesa na sobra do mês nem na projeção.</p>
          </div>
        )}
        {aceitaEstimativa(o, modo) && (
          <Interruptor rotulo="Usar este valor como estimativa das próximas" marcado={estimativa} aoMudar={setEstimativa} />
        )}
        <Erro mensagem={erro} />
        <Botao onClick={salvar} carregando={salvando} disabled={!data}>
          Confirmar pagamento
        </Botao>
      </div>
    </Modal>
  );
}

/** Detalhe da ocorrência com as ações possíveis. */
export function ModalOcorrencia({
  o,
  aoFechar,
  aoPagar,
}: {
  o: Ocorrencia | null;
  aoFechar: () => void;
  aoPagar: (o: Ocorrencia) => void;
}) {
  if (!o) return null;
  return <DetalheOcorrencia key={o.id} o={o} aoFechar={aoFechar} aoPagar={aoPagar} />;
}

function DetalheOcorrencia({ o, aoFechar, aoPagar }: { o: Ocorrencia; aoFechar: () => void; aoPagar: (o: Ocorrencia) => void }) {
  const { sincronizar, nomeDono, nomeCategoria, categorias, membros } = useApp();
  const [previsto, setPrevisto] = useState(o.valor_previsto);
  const [descricao, setDescricao] = useState(o.descricao);
  const [categoria, setCategoria] = useState(o.categoria_id ?? "");
  const [dono, setDono] = useState(o.dono_membro_id ?? "");
  const [vencimento, setVencimento] = useState(o.vencimento);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const editavelLivre = o.origem_tipo === "pontual" || o.origem_tipo === "parcela_projeto" || o.origem_tipo === "pagamento_divida";

  async function acao(fn: () => Promise<unknown>, pergunta?: string) {
    if (pergunta && !confirm(pergunta)) return;
    setErro(null);
    setOcupado(true);
    try {
      await fn();
      await sincronizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function salvarEdicao() {
    if (editavelLivre) {
      checar(
        await supabase()
          .from("ocorrencias")
          .update({
            descricao: descricao.trim() || o.descricao,
            categoria_id: categoria || null,
            dono_membro_id: dono || null,
            vencimento,
            valor_previsto: previsto,
          })
          .eq("id", o.id),
      );
    } else if (previsto !== o.valor_previsto) {
      await ajustarPrevisto(o, previsto);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={o.descricao}>
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-500">Tipo</dt>
          <dd>
            {o.tipo === "entrada" ? "Entrada" : "Saída"} · {ROTULO_ORIGEM[o.origem_tipo]}
          </dd>
          <dt className="text-slate-500">Vencimento</dt>
          <dd>{formatarData(o.vencimento)}</dd>
          <dt className="text-slate-500">Categoria</dt>
          <dd>{nomeCategoria(o.categoria_id)}</dd>
          <dt className="text-slate-500">Dono</dt>
          <dd>{nomeDono(o.dono_membro_id)}</dd>
          <dt className="text-slate-500">Status</dt>
          <dd>
            <SeloStatus o={o} />
          </dd>
          {o.status === "pago" && (
            <>
              <dt className="text-slate-500">Pago</dt>
              <dd>
                {formatarReais(o.valor_real ?? 0)} em {formatarData(o.pago_em)}
              </dd>
            </>
          )}
          {o.fonte && (
            <>
              <dt className="text-slate-500">Origem</dt>
              <dd>{o.fonte}</dd>
            </>
          )}
          {o.observacao && (
            <>
              <dt className="text-slate-500">Observação</dt>
              <dd>{o.observacao}</dd>
            </>
          )}
        </dl>

        {o.status === "pendente" && (
          <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            {editavelLivre && (
              <>
                <Campo rotulo="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                <Campo rotulo="Vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
                <SeletorCategoria tipo={o.tipo} valor={categoria} aoMudar={setCategoria} categorias={categorias} />
                <SeletorDono valor={dono} aoMudar={setDono} membros={membros} />
              </>
            )}
            <CampoValor rotulo={editavelLivre ? "Valor previsto" : "Valor previsto só deste mês"} valor={previsto} aoMudar={setPrevisto} />
            <Botao variante="secundario" carregando={ocupado} onClick={() => acao(salvarEdicao)}>
              Salvar alterações
            </Botao>
          </div>
        )}

        <Erro mensagem={erro} />
        <div className="flex flex-col gap-2">
          {o.status === "pendente" && (
            <Botao
              onClick={() => {
                aoFechar();
                aoPagar(o);
              }}
            >
              Marcar como pago
            </Botao>
          )}
          {o.status === "pago" && o.observacao !== "Meta cumprida com pagamentos avulsos" && (
            <Botao variante="secundario" carregando={ocupado} onClick={() => acao(() => desfazerPagamento(o), "Desfazer este pagamento?")}>
              Desfazer pagamento
            </Botao>
          )}
          {o.tipo === "saida" && o.status !== "cancelado" && (
            <Botao variante="secundario" carregando={ocupado} onClick={() => acao(() => marcarComReserva(o, !o.paga_com_reserva))}>
              {o.paga_com_reserva ? "Desmarcar “dinheiro guardado”" : "Marcar como paga com dinheiro guardado"}
            </Botao>
          )}
          {o.status !== "pago" && o.origem_tipo !== "pontual" && (
            <Botao variante="secundario" carregando={ocupado} onClick={() => acao(() => cancelarOcorrencia(o, o.status !== "cancelado"))}>
              {o.status === "cancelado" ? "Reativar" : "Cancelar este mês"}
            </Botao>
          )}
          {editavelLivre && (
            <Botao variante="perigo" carregando={ocupado} onClick={() => acao(() => excluirOcorrencia(o.id), "Excluir este lançamento?")}>
              Excluir
            </Botao>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function SeletorCategoria({
  tipo,
  valor,
  aoMudar,
  categorias,
}: {
  tipo: "entrada" | "saida";
  valor: string;
  aoMudar: (v: string) => void;
  categorias: { id: string; nome: string; tipo: string; ativa: boolean }[];
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Categoria
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-900"
      >
        <option value="">Sem categoria</option>
        {categorias
          .filter((c) => c.tipo === tipo && (c.ativa || c.id === valor))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
      </select>
    </div>
  );
}

export function SeletorDono({
  valor,
  aoMudar,
  membros,
  rotulo = "Dono",
}: {
  valor: string;
  aoMudar: (v: string) => void;
  membros: { id: string; nome: string }[];
  rotulo?: string;
}) {
  const opcoes = [...membros.map((m) => ({ id: m.id, nome: m.nome })), { id: "", nome: "Casal" }];
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">{rotulo}</legend>
      <div className="flex gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-800">
        {opcoes.map((o) => (
          <button
            key={o.id || "casal"}
            type="button"
            aria-pressed={valor === o.id}
            onClick={() => aoMudar(o.id)}
            className={clsx(
              "min-h-9 flex-1 truncate rounded-lg px-2 text-sm font-medium",
              valor === o.id ? "bg-white shadow-sm dark:bg-slate-950" : "text-slate-600 dark:text-slate-400",
            )}
          >
            {o.nome}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
