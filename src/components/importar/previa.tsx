"use client";

import clsx from "clsx";
import { Fragment, useMemo, useState } from "react";
import { paraConfirmacao } from "@/lib/caixa-entrada";
import { formatarData, formatarDiaMes } from "@/lib/datas";
import { formatarReais } from "@/lib/dinheiro";
import type { Perfil, TransacaoExtrato } from "@/lib/importacao/extrato";
import { candidatas, type Acao } from "@/lib/importacao/sugestao";
import { semAcentos } from "@/lib/importacao/texto";
import { ROTULO_RACHA } from "@/lib/racha";
import type { Ocorrencia, RachaTipo } from "@/lib/tipos";
import { useApp } from "../app-contexto";
import { Botao, Campo, Cartao, Dinheiro, Erro, formatarErro, Interruptor, Selo } from "../ui";

export interface LinhaPrevia {
  t: TransacaoExtrato;
  hash: string;
  jaImportada: boolean;
  acao: Acao;
  categoria_id: string;
  /** "" = Casal */
  dono: string;
  racha_tipo: RachaTipo;
  vinculo_id: string;
  motivo: string;
  padrao: string;
  /** saída paga com dinheiro guardado (fora da sobra e da projeção) */
  com_reserva?: boolean;
}

const ROTULO_ACAO: Record<Acao, string> = { novo: "Novo lançamento", vincular: "Vincular", racha: "Racha", ignorar: "Ignorar" };
const estiloSelect = "min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900";

export function Previa({
  nome,
  perfil,
  linhasIniciais,
  pendentes,
  descartadas,
  aoCancelar,
  aoConfirmar,
  caixa = false,
  detalhe,
}: {
  nome: string;
  perfil?: Perfil;
  linhasIniciais: LinhaPrevia[];
  pendentes: Ocorrencia[];
  descartadas: number;
  aoCancelar?: () => void;
  aoConfirmar: (linhas: Record<string, unknown>[]) => Promise<void>;
  /** Caixa de entrada: agrupa por dia e confirma só as linhas selecionadas. */
  caixa?: boolean;
  /** texto extra por linha (ex.: nome da conta) */
  detalhe?: (l: LinhaPrevia) => string;
}) {
  const { categorias, membros, casa } = useApp();
  const [linhas, setLinhas] = useState(linhasIniciais);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [aPartirDe, setAPartirDe] = useState("");
  const [mostrarImportadas, setMostrarImportadas] = useState(true);
  const [loteAcao, setLoteAcao] = useState<Acao>("ignorar");
  const [loteCategoria, setLoteCategoria] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const tipos = useMemo(() => [...new Set(linhasIniciais.map((l) => l.t.tipo).filter(Boolean))].sort(), [linhasIniciais]);
  const candidatasPorHash = useMemo(() => {
    const m = new Map<string, Ocorrencia[]>();
    for (const l of linhasIniciais) m.set(l.hash, candidatas(l.t, pendentes));
    return m;
  }, [linhasIniciais, pendentes]);

  const incluida = (l: LinhaPrevia) => !l.jaImportada && (!aPartirDe || l.t.data >= aPartirDe);
  const visiveis = linhas.filter((l) => {
    if (!mostrarImportadas && l.jaImportada) return false;
    if (filtroTipo === "__entradas" && l.t.valor < 0) return false;
    if (filtroTipo === "__saidas" && l.t.valor >= 0) return false;
    if (filtroTipo && !filtroTipo.startsWith("__") && l.t.tipo !== filtroTipo) return false;
    if (filtroTexto && !semAcentos(l.t.descricao).includes(semAcentos(filtroTexto))) return false;
    return true;
  });
  const aImportar = linhas.filter(incluida);
  // Na caixa de entrada só vai o que estiver selecionado.
  const aEnviar = caixa ? aImportar.filter((l) => selecionadas.has(l.hash)) : aImportar;
  const contagem = aImportar.reduce<Record<string, number>>((c, l) => ({ ...c, [l.acao]: (c[l.acao] ?? 0) + 1 }), {});
  const jaImportadas = linhas.filter((l) => l.jaImportada).length;
  const selecionaveis = visiveis.filter(incluida);
  const todasSelecionadas = selecionaveis.length > 0 && selecionaveis.every((l) => selecionadas.has(l.hash));

  function alterar(hash: string, campos: Partial<LinhaPrevia>) {
    setLinhas((ls) => ls.map((l) => (l.hash === hash ? { ...l, ...campos } : l)));
  }

  function aplicarLote(campos: (l: LinhaPrevia) => Partial<LinhaPrevia>) {
    setLinhas((ls) => ls.map((l) => (selecionadas.has(l.hash) ? { ...l, ...campos(l) } : l)));
  }

  function alternarTodas() {
    setSelecionadas((s) => {
      const n = new Set(s);
      if (todasSelecionadas) selecionaveis.forEach((l) => n.delete(l.hash));
      else selecionaveis.forEach((l) => n.add(l.hash));
      return n;
    });
  }

  async function confirmar() {
    setErro(null);
    const usados = new Map<string, number>();
    for (const l of aEnviar) {
      if (l.acao !== "vincular") continue;
      if (!l.vinculo_id) return setErro(`Escolha o lançamento a vincular: ${l.t.descricao} (${formatarData(l.t.data)}).`);
      usados.set(l.vinculo_id, (usados.get(l.vinculo_id) ?? 0) + 1);
    }
    if ([...usados.values()].some((n) => n > 1)) return setErro("O mesmo lançamento previsto foi escolhido para mais de uma linha.");
    if (!aEnviar.length) return setErro(caixa ? "Selecione as linhas que quer confirmar." : "Nenhuma linha para importar.");
    setSalvando(true);
    try {
      await aoConfirmar(aEnviar.map(paraConfirmacao));
      if (caixa) setSalvando(false);
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  const categoriasDe = (valor: number) => categorias.filter((c) => c.ativa && c.tipo === (valor >= 0 ? "entrada" : "saida"));

  return (
    <>
      <Cartao className="mb-3">
        <p className="truncate font-semibold">{nome}</p>
        <p className="text-xs text-slate-500">
          {perfil && `Perfil: ${perfil.nome} · `}
          {linhas.length} linhas{descartadas ? ` (${descartadas} sem data/valor descartadas)` : ""}
          {jaImportadas ? ` · ${jaImportadas} já importadas` : ""}
        </p>
        <p className="mt-2 text-sm">
          {caixa ? "Sugestões para revisar" : "Vão ser importadas"} <strong>{aImportar.length}</strong>:{" "}
          {(Object.keys(ROTULO_ACAO) as Acao[])
            .filter((a) => contagem[a])
            .map((a) => `${contagem[a]} ${ROTULO_ACAO[a].toLowerCase()}`)
            .join(" · ") || "nenhuma"}
        </p>
      </Cartao>

      <Cartao className="mb-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="filtro-tipo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Tipo
            </label>
            <select
              id="filtro-tipo"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className={clsx(estiloSelect, "min-h-11")}
            >
              <option value="">Todos</option>
              <option value="__entradas">Só entradas</option>
              <option value="__saidas">Só saídas</option>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <Campo
            rotulo={caixa ? "A partir de" : "Importar a partir de"}
            type="date"
            value={aPartirDe}
            onChange={(e) => setAPartirDe(e.target.value)}
          />
          <div className="col-span-2">
            <Campo
              rotulo="Buscar no texto"
              placeholder="Nome, tipo..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
            />
          </div>
        </div>
        {!caixa && <Interruptor rotulo="Mostrar linhas já importadas" marcado={mostrarImportadas} aoMudar={setMostrarImportadas} />}
      </Cartao>

      {/* Ações em lote */}
      <div className="sticky top-0 z-20 mb-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-5 accent-emerald-600" checked={todasSelecionadas} onChange={alternarTodas} />
            {selecionadas.size ? `${selecionadas.size} selecionadas` : `Selecionar as ${selecionaveis.length} visíveis`}
          </label>
          {selecionadas.size > 0 && (
            <button type="button" className="text-xs text-slate-500 underline" onClick={() => setSelecionadas(new Set())}>
              limpar
            </button>
          )}
        </div>
        {selecionadas.size > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            <select
              aria-label="Ação em lote"
              value={loteAcao}
              onChange={(e) => setLoteAcao(e.target.value as Acao)}
              className={estiloSelect}
            >
              {(["novo", "racha", "ignorar"] as Acao[]).map((a) => (
                <option key={a} value={a}>
                  {ROTULO_ACAO[a]}
                </option>
              ))}
            </select>
            <Botao variante="secundario" className="!min-h-9 !px-3" onClick={() => aplicarLote(() => ({ acao: loteAcao }))}>
              Aplicar ação
            </Botao>
            <select
              aria-label="Categoria em lote"
              value={loteCategoria}
              onChange={(e) => setLoteCategoria(e.target.value)}
              className={estiloSelect}
            >
              <option value="">Sem categoria</option>
              {categorias
                .filter((c) => c.ativa)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.tipo === "entrada" ? "entrada" : "saída"})
                  </option>
                ))}
            </select>
            <Botao
              variante="secundario"
              className="!min-h-9 !px-3"
              onClick={() => {
                const cat = categorias.find((c) => c.id === loteCategoria);
                // Só aplica a categoria nas linhas do mesmo sentido (entrada/saída).
                aplicarLote((l) =>
                  !cat || (cat.tipo === "entrada") === l.t.valor >= 0 ? { categoria_id: loteCategoria, acao: "novo" } : {},
                );
              }}
            >
              Aplicar categoria
            </Botao>
            <Botao
              variante="secundario"
              className="!min-h-9 !px-3"
              onClick={() => aplicarLote((l) => (l.t.valor < 0 ? { com_reserva: !l.com_reserva } : {}))}
            >
              Alternar “dinheiro guardado”
            </Botao>
          </div>
        )}
      </div>

      <ul className="mb-4 flex flex-col gap-2">
        {visiveis.map((l, i) => {
          const fora = !incluida(l);
          const cands = candidatasPorHash.get(l.hash) ?? [];
          const novoDia = caixa && (i === 0 || visiveis[i - 1].t.data !== l.t.data);
          return (
            <Fragment key={l.hash}>
              {novoDia && (
                <li className="mt-2 px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{formatarData(l.t.data)}</li>
              )}
              <li
                className={clsx(
                  "rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900",
                  fora && "opacity-50",
                  selecionadas.has(l.hash) && "border-emerald-400",
                )}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${l.t.descricao}`}
                    className="mt-1 size-5 accent-emerald-600"
                    disabled={fora}
                    checked={selecionadas.has(l.hash)}
                    onChange={() =>
                      setSelecionadas((s) => {
                        const n = new Set(s);
                        if (n.has(l.hash)) n.delete(l.hash);
                        else n.add(l.hash);
                        return n;
                      })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-tight font-medium break-words">{l.t.descricao}</p>
                      <Dinheiro valor={l.t.valor} sinal className="shrink-0 text-sm font-semibold" />
                    </div>
                    <p className="text-xs text-slate-500">
                      {!caixa && formatarData(l.t.data)}
                      {detalhe && detalhe(l)}
                      {l.t.hora && ` ${l.t.hora}`}
                      {l.jaImportada && (
                        <>
                          {" "}
                          <Selo cor="azul">já importada</Selo>
                        </>
                      )}
                      {!l.jaImportada && l.motivo && ` · sugestão: ${l.motivo}`}
                    </p>
                    {!fora && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <select
                          aria-label="Ação"
                          value={l.acao}
                          onChange={(e) => {
                            const acao = e.target.value as Acao;
                            alterar(l.hash, {
                              acao,
                              vinculo_id: acao === "vincular" && !l.vinculo_id ? (cands[0]?.id ?? "") : l.vinculo_id,
                            });
                          }}
                          className={estiloSelect}
                        >
                          {(Object.keys(ROTULO_ACAO) as Acao[])
                            .filter((a) => a !== "racha" || casa.racha_ativo)
                            .map((a) => (
                              <option key={a} value={a}>
                                {ROTULO_ACAO[a]}
                              </option>
                            ))}
                        </select>
                        {l.acao === "novo" && (
                          <>
                            <select
                              aria-label="Categoria"
                              value={l.categoria_id}
                              onChange={(e) => alterar(l.hash, { categoria_id: e.target.value })}
                              className={estiloSelect}
                            >
                              <option value="">Sem categoria</option>
                              {categoriasDe(l.t.valor).map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.nome}
                                </option>
                              ))}
                            </select>
                            <select
                              aria-label="Dono"
                              value={l.dono}
                              onChange={(e) => alterar(l.hash, { dono: e.target.value })}
                              className={estiloSelect}
                            >
                              {membros.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nome}
                                </option>
                              ))}
                              <option value="">Casal</option>
                            </select>
                          </>
                        )}
                        {l.acao === "vincular" &&
                          (cands.length ? (
                            <select
                              aria-label="Lançamento previsto"
                              value={l.vinculo_id}
                              onChange={(e) => alterar(l.hash, { vinculo_id: e.target.value })}
                              className={clsx(estiloSelect, "max-w-full")}
                            >
                              <option value="">Escolha...</option>
                              {cands.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.descricao} · {formatarDiaMes(o.vencimento)} · {formatarReais(o.valor_previsto)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="self-center text-xs text-red-600">Nenhum previsto com valor e data próximos.</span>
                          ))}
                        {(l.acao === "novo" || l.acao === "vincular") && l.t.valor < 0 && (
                          <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                            <input
                              type="checkbox"
                              className="size-4 accent-emerald-600"
                              checked={!!l.com_reserva}
                              onChange={(e) => alterar(l.hash, { com_reserva: e.target.checked })}
                            />
                            dinheiro guardado
                          </label>
                        )}
                        {l.acao === "racha" && (
                          <select
                            aria-label="Tipo no racha"
                            value={l.racha_tipo}
                            onChange={(e) => alterar(l.hash, { racha_tipo: e.target.value as RachaTipo })}
                            className={estiloSelect}
                          >
                            {(Object.keys(ROTULO_RACHA) as RachaTipo[]).map((t) => (
                              <option key={t} value={t}>
                                {ROTULO_RACHA[t]}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            </Fragment>
          );
        })}
        {visiveis.length === 0 && <li className="py-6 text-center text-sm text-slate-500">Nenhuma linha com esses filtros.</li>}
      </ul>

      <div className="fab sticky z-20 flex flex-col gap-2 rounded-2xl bg-slate-50/95 py-2 backdrop-blur dark:bg-slate-950/95">
        <Erro mensagem={erro} />
        <Botao onClick={confirmar} carregando={salvando} disabled={!aEnviar.length}>
          {caixa ? `Confirmar sugestões selecionadas (${aEnviar.length})` : `Confirmar importação de ${aImportar.length} linhas`}
        </Botao>
        {aoCancelar && (
          <Botao variante="fantasma" onClick={aoCancelar}>
            Cancelar
          </Botao>
        )}
      </div>
    </>
  );
}
