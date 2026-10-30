"use client";

import clsx from "clsx";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import type { ContaExterna } from "@/lib/caixa-entrada";
import { criarCartao } from "@/lib/cartoes";
import { formatarData } from "@/lib/datas";
import { buscarTodos, checar } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { COMO_RENOVAR, descreverEstado, type EstadoItem } from "@/lib/pluggy/conexoes";
import { supabase } from "@/lib/supabase";
import type { Cartao as TCartao } from "@/lib/tipos";
import { useApp, useCarregar } from "./app-contexto";
import { Botao, Cartao, Erro, formatarErro, Interruptor, Selo, Titulo } from "./ui";

interface ItemPluggy extends EstadoItem {
  id: string;
}

const estiloSelect = "min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900";

/** Bancos conectados pelo Open Finance (Meu Pluggy): estado, contas, donos e vínculo com cartões. */
export function BancosConectados() {
  const { casa, categorias, bancos, sincronizarBancos, membros, nomeDono, atualizar } = useApp();
  const [erro, setErro] = useState<string | null>(null);
  const { dados, recarregar } = useCarregar("bancos-conectados", async () => {
    const [itens, contas, cartoes] = await Promise.all([
      buscarTodos<ItemPluggy>("pluggy_itens", casa.id),
      buscarTodos<ContaExterna>("contas_externas", casa.id, undefined, "nome"),
      buscarTodos<TCartao>("cartoes", casa.id, undefined, "nome"),
    ]);
    return { itens, contas, cartoes };
  });

  async function executar(fn: () => Promise<unknown>) {
    setErro(null);
    try {
      await fn();
      recarregar();
    } catch (e) {
      setErro(formatarErro(e));
    }
  }

  const mudarConta = (id: string, campos: Record<string, unknown>) =>
    executar(async () => checar(await supabase().from("contas_externas").update(campos).eq("id", id)));

  async function mudarRegrasAuto(v: boolean) {
    await executar(async () => checar(await supabase().from("casas").update({ aplicar_regras_auto: v }).eq("id", casa.id)));
    await atualizar();
  }

  /** Cria um cartão no app a partir de uma conta de cartão do banco e já vincula. */
  function criarCartaoDaConta(c: ContaExterna) {
    return executar(async () => {
      const dia = Number((c.dados.vencimento ?? "").slice(8, 10)) || 10;
      const novo = await criarCartao(casa.id, categorias, { nome: c.nome, dono_membro_id: c.dono_membro_id, dia_vencimento: dia });
      checar(await supabase().from("contas_externas").update({ cartao_id: novo }).eq("id", c.id));
      await atualizar();
      // A sincronização traz as faturas para o cartão novo.
      sincronizarBancos().catch(() => {});
    });
  }

  // Itens agrupados pelo dono (cada membro e, por fim, Casal).
  const grupos = [...membros.map((m) => m.id), null]
    .map((dono) => ({ dono, itens: (dados?.itens ?? []).filter((i) => i.dono_membro_id === dono) }))
    .filter((g) => g.itens.length);

  return (
    <Cartao className="lg:col-span-2">
      <Titulo
        acao={
          <Botao variante="secundario" carregando={bancos.sincronizando} onClick={() => sincronizarBancos().catch(() => {})}>
            <RefreshCw className="size-4" aria-hidden /> Sincronizar agora
          </Botao>
        }
      >
        Bancos conectados
      </Titulo>
      <Erro mensagem={bancos.erro ?? erro} />
      {bancos.resumo && !bancos.sincronizando && (
        <p role="status" className="mb-2 text-sm text-emerald-700 dark:text-emerald-400">
          Sincronizado: {bancos.resumo.novas} novas na caixa de entrada, {bancos.resumo.jaImportadas} já importadas por arquivo, {bancos.resumo.cartao}{" "}
          de cartão
          {bancos.automaticas ? `, ${bancos.automaticas} confirmadas por regra` : ""}.
          {bancos.resumo.erros.length > 0 && ` ${bancos.resumo.erros.length} problema(s): ${bancos.resumo.erros.join("; ")}`}
        </p>
      )}

      <div className="mb-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
        <Interruptor rotulo="Aplicar regras aprendidas automaticamente" marcado={casa.aplicar_regras_auto} aoMudar={mudarRegrasAuto} />
        <p className="text-xs text-slate-500">
          Transações que batem com uma regra aprendida são confirmadas sem passar pela caixa de entrada. Elas aparecem no histórico da caixa, com opção de
          desfazer.
        </p>
      </div>

      {!grupos.length ? (
        <p className="text-sm text-slate-500">
          Nenhum banco sincronizado ainda. Toque em “Sincronizar agora”. Os bancos vêm das variáveis PLUGGY_ITEMS_&lt;NOME&gt; do servidor.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map((g) => (
            <section key={g.dono ?? "casal"}>
              <h3 className="mb-2 text-sm font-semibold">{nomeDono(g.dono)}</h3>
              <ul className="flex flex-col gap-3">
                {g.itens.map((i) => {
                  const problema = !!(i.erro_codigo || i.ultimo_erro || i.status === "LOGIN_ERROR");
                  return (
                    <li key={i.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{i.banco ?? "Banco"}</p>
                        <Selo cor={problema ? "vermelho" : i.status === "UPDATED" ? "verde" : "amarelo"}>{descreverEstado(i)}</Selo>
                      </div>
                      <p className="text-xs text-slate-500">
                        {i.ultima_sincronizacao ? `Última sincronização ${formatarData(i.ultima_sincronizacao.slice(0, 10))}` : "Ainda não sincronizado"}
                        {i.consent_expires_at && ` · autorização até ${formatarData(i.consent_expires_at.slice(0, 10))}`}
                      </p>
                      {problema && <p className="mt-1 text-xs text-slate-500">{COMO_RENOVAR}</p>}
                      <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                        {(dados?.contas ?? [])
                          .filter((c) => c.pluggy_item_id === i.pluggy_item_id)
                          .map((c) => (
                            <LinhaConta
                              key={c.id}
                              conta={c}
                              cartoes={dados?.cartoes ?? []}
                              mudar={(campos) => mudarConta(c.id, campos)}
                              aoVincular={() => sincronizarBancos().catch(() => {})}
                              aoCriarCartao={() => criarCartaoDaConta(c)}
                            />
                          ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Cartao>
  );
}

function LinhaConta({
  conta,
  cartoes,
  mudar,
  aoVincular,
  aoCriarCartao,
}: {
  conta: ContaExterna;
  cartoes: TCartao[];
  mudar: (campos: Record<string, unknown>) => Promise<void>;
  aoVincular: () => void;
  aoCriarCartao: () => void;
}) {
  const { membros } = useApp();
  const [nome, setNome] = useState(conta.nome);
  const credito = conta.tipo === "CREDIT";
  return (
    <li className={clsx("flex flex-col gap-2 py-2", !conta.ativa && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Nome da conta"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={() => nome.trim() && nome !== conta.nome && mudar({ nome: nome.trim() })}
          className={clsx(estiloSelect, "min-w-0 flex-1 font-medium")}
        />
        <Selo cor={credito ? "azul" : "slate"}>{credito ? "Cartão" : conta.subtipo === "SAVINGS_ACCOUNT" ? "Poupança" : "Conta corrente"}</Selo>
        <span className="text-sm tabular-nums">{conta.saldo !== null && formatarReais(conta.saldo)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1">
          Dono
          <select
            className={estiloSelect}
            value={conta.dono_membro_id ?? ""}
            onChange={(e) => mudar({ dono_membro_id: e.target.value || null, dono_manual: true })}
          >
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
            <option value="">Casal</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" className="size-4 accent-emerald-600" checked={conta.ativa} onChange={(e) => mudar({ ativa: e.target.checked })} />
          Ativa
        </label>
        {credito && (
          <>
            <label className="flex items-center gap-1">
              Cartão no app
              <select
                className={estiloSelect}
                value={conta.cartao_id ?? ""}
                onChange={async (e) => {
                  await mudar({ cartao_id: e.target.value || null });
                  if (e.target.value) aoVincular();
                }}
              >
                <option value="">— nenhum —</option>
                {cartoes.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nome}
                  </option>
                ))}
              </select>
            </label>
            {!conta.cartao_id && (
              <Botao variante="fantasma" className="!min-h-9 !px-2 text-emerald-700" onClick={aoCriarCartao}>
                Criar cartão com esta conta
              </Botao>
            )}
          </>
        )}
      </div>
      {credito && conta.dados.limite != null && (
        <p className="text-xs text-slate-500">
          Limite {formatarReais(conta.dados.limite)}
          {conta.dados.disponivel != null && ` · disponível ${formatarReais(conta.dados.disponivel)}`}
        </p>
      )}
    </li>
  );
}
