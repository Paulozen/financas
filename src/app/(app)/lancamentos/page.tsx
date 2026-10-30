"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { daVisao, useApp, useCarregar } from "@/components/app-contexto";
import { Cabecalho, SeletorMes } from "@/components/cabecalho";
import { FormPontual, FormRecorrencia } from "@/components/form-lancamentos";
import { LinhaOcorrencia, ModalOcorrencia, ModalPagar, valorEfetivo } from "@/components/ocorrencias";
import { Abas, Botao, Cartao, Carregando, Dinheiro, Erro, Selecao, Selo, Titulo, Vazio } from "@/components/ui";
import { formatarData, hojeISO, primeiroDia, ultimoDia } from "@/lib/datas";
import { buscarTodos } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import type { Ocorrencia, Recorrencia } from "@/lib/tipos";

export default function Lancamentos() {
  const [aba, setAba] = useState<"mes" | "recorrentes">("mes");
  return (
    <>
      <Cabecalho titulo="Lançamentos" />
      <Abas
        abas={[
          { valor: "mes", rotulo: "Do mês" },
          { valor: "recorrentes", rotulo: "Recorrentes" },
        ]}
        atual={aba}
        aoMudar={setAba}
      />
      {aba === "mes" ? <DoMes /> : <Recorrentes />}
    </>
  );
}

function DoMes() {
  const { casa, mes, visao, categorias, membros } = useApp();
  const [tipo, setTipo] = useState("");
  const [status, setStatus] = useState("");
  const [categoria, setCategoria] = useState("");
  const [dono, setDono] = useState("");
  const [aberta, setAberta] = useState<Ocorrencia | null>(null);
  const [pagando, setPagando] = useState<Ocorrencia | null>(null);
  const [novo, setNovo] = useState(false);
  // No computador os filtros já começam abertos (a tela só é montada no navegador).
  const [filtrosAbertos] = useState(() => window.matchMedia("(min-width: 1024px)").matches);

  const { dados, erro, carregando } = useCarregar(`lanc:${mes}`, () =>
    buscarTodos<Ocorrencia>(
      "ocorrencias",
      casa.id,
      (q) => q.gte("vencimento", primeiroDia(mes)).lte("vencimento", ultimoDia(mes)),
      "vencimento",
    ),
  );

  const hoje = hojeISO();
  const lista = useMemo(() => {
    let l = daVisao(dados ?? [], visao);
    if (tipo) l = l.filter((o) => o.tipo === tipo);
    if (status === "atrasado") l = l.filter((o) => o.status === "pendente" && o.vencimento < hoje);
    else if (status) l = l.filter((o) => o.status === status);
    if (categoria) l = l.filter((o) => (categoria === "-" ? !o.categoria_id : o.categoria_id === categoria));
    if (dono) l = l.filter((o) => (dono === "casal" ? !o.dono_membro_id : o.dono_membro_id === dono));
    return l;
  }, [dados, visao, tipo, status, categoria, dono, hoje]);

  const ativos = lista.filter((o) => o.status !== "cancelado");
  const soma = (t: string, soPagos = false) =>
    ativos.filter((o) => o.tipo === t && (!soPagos || o.status === "pago")).reduce((s, o) => s + valorEfetivo(o), 0);
  const entradas = soma("entrada");
  const saidas = soma("saida");

  return (
    <div className="lg:grid lg:grid-cols-[22rem_1fr] lg:items-start lg:gap-6">
      <div className="lg:sticky lg:top-6">
        <SeletorMes />
        <Cartao className="mb-4">
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="text-slate-500">Entradas</p>
              <Dinheiro valor={entradas} className="font-semibold text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-slate-500">Saídas</p>
              <Dinheiro valor={saidas} className="font-semibold text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-slate-500">Saldo</p>
              <Dinheiro valor={entradas - saidas} sinal className="font-semibold" />
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">
            Realizado: {formatarReais(soma("entrada", true))} entrou · {formatarReais(soma("saida", true))} saiu
          </p>
        </Cartao>

        <details className="mb-4" open={filtrosAbertos}>
          <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-400">Filtros</summary>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Selecao
              rotulo="Tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              vazio="Todos"
              opcoes={[
                { valor: "entrada", rotulo: "Entradas" },
                { valor: "saida", rotulo: "Saídas" },
              ]}
            />
            <Selecao
              rotulo="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              vazio="Todos"
              opcoes={[
                { valor: "pendente", rotulo: "Pendentes" },
                { valor: "atrasado", rotulo: "Atrasados" },
                { valor: "pago", rotulo: "Pagos" },
                { valor: "cancelado", rotulo: "Cancelados" },
              ]}
            />
            <Selecao
              rotulo="Categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              vazio="Todas"
              opcoes={[{ valor: "-", rotulo: "Sem categoria" }, ...categorias.map((c) => ({ valor: c.id, rotulo: c.nome }))]}
            />
            <Selecao
              rotulo="Dono"
              value={dono}
              onChange={(e) => setDono(e.target.value)}
              vazio="Todos"
              opcoes={[...membros.map((m) => ({ valor: m.id, rotulo: m.nome })), { valor: "casal", rotulo: "Só do casal" }]}
            />
          </div>
        </details>
      </div>

      <div>
        <Erro mensagem={erro} />
        {carregando && !dados ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio
            titulo="Nada neste mês"
            texto="Cadastre seu salário e as contas fixas na aba Recorrentes, ou use o + para um lançamento rápido."
          />
        ) : (
          <Cartao>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {lista.map((o) => (
                <LinhaOcorrencia key={o.id} o={o} aoAbrir={() => setAberta(o)} aoPagar={() => setPagando(o)} />
              ))}
            </ul>
          </Cartao>
        )}

        <button
          type="button"
          onClick={() => setNovo(true)}
          aria-label="Novo lançamento rápido"
          className="fab fixed right-4 z-30 flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 sm:right-[calc(50%-20rem)] lg:right-8"
        >
          <Plus className="size-7" />
        </button>
      </div>

      {novo && <FormPontual aoFechar={() => setNovo(false)} />}
      <ModalOcorrencia o={aberta} aoFechar={() => setAberta(null)} aoPagar={setPagando} />
      <ModalPagar o={pagando} aoFechar={() => setPagando(null)} />
    </div>
  );
}

function Recorrentes() {
  const { casa, visao, nomeDono, nomeCategoria } = useApp();
  const [editando, setEditando] = useState<Recorrencia | "nova" | null>(null);
  const { dados, erro, carregando } = useCarregar("recorrencias", () =>
    buscarTodos<Recorrencia>("recorrencias", casa.id, (q) => q.is("cartao_id", null), "descricao"),
  );
  const regras = daVisao(dados ?? [], visao);
  const hoje = hojeISO();

  const grupo = (tipo: "entrada" | "saida", titulo: string) => {
    const l = regras.filter((r) => r.tipo === tipo);
    if (!l.length) return null;
    return (
      <Cartao className="mb-4">
        <Titulo>{titulo}</Titulo>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {l.map((r) => {
            const encerrada = r.fim && r.fim < hoje;
            return (
              <li key={r.id}>
                <button type="button" onClick={() => setEditando(r)} className="flex w-full items-center gap-2 py-2 text-left">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{r.descricao}</span>
                    <span className="text-xs text-slate-500">
                      Dia {r.dia} · {nomeCategoria(r.categoria_id)} · {nomeDono(r.dono_membro_id)}
                      {r.fim && ` · até ${formatarData(r.fim)}`}
                    </span>
                  </span>
                  {r.modo === "variavel" && <Selo cor="azul">{r.valor_manual ? "variável" : "média"}</Selo>}
                  {encerrada && <Selo>encerrada</Selo>}
                  <Dinheiro valor={r.valor} className="text-sm font-semibold" />
                </button>
              </li>
            );
          })}
        </ul>
      </Cartao>
    );
  };

  return (
    <>
      <Botao className="mb-4 w-full lg:w-auto" onClick={() => setEditando("nova")}>
        <Plus className="size-4" /> Nova receita ou despesa recorrente
      </Botao>
      <Erro mensagem={erro} />
      {carregando && !dados ? (
        <Carregando />
      ) : regras.length === 0 ? (
        <Vazio
          titulo="Nenhuma recorrente"
          texto="Cadastre seu salário para começar. Depois, as contas fixas (aluguel, internet) e as variáveis (luz, água)."
        />
      ) : (
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
          {grupo("entrada", "Receitas")}
          {grupo("saida", "Despesas")}
        </div>
      )}
      {editando && (
        <FormRecorrencia
          regra={editando === "nova" ? undefined : editando}
          tipoInicial={regras.some((r) => r.tipo === "entrada") ? "saida" : "entrada"}
          aoFechar={() => setEditando(null)}
        />
      )}
    </>
  );
}
