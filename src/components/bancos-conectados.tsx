"use client";

import { RefreshCw } from "lucide-react";
import { formatarData } from "@/lib/datas";
import { buscarTodos } from "@/lib/db";
import { useApp, useCarregar } from "./app-contexto";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Botao, Cartao, Erro, formatarErro, Interruptor, Titulo } from "./ui";

interface ItemPluggy {
  id: string;
  pluggy_item_id: string;
  dono_membro_id: string | null;
  banco: string | null;
  status: string | null;
  erro_codigo: string | null;
  consent_expires_at: string | null;
  ultima_sincronizacao: string | null;
  ultimo_erro: string | null;
}

/** Bancos conectados pelo Open Finance (Meu Pluggy). */
export function BancosConectados() {
  const { casa, bancos, sincronizarBancos, nomeDono, atualizar } = useApp();
  const [erroRegra, setErroRegra] = useState<string | null>(null);

  async function mudarRegrasAuto(v: boolean) {
    setErroRegra(null);
    const { error } = await supabase().from("casas").update({ aplicar_regras_auto: v }).eq("id", casa.id);
    if (error) return setErroRegra(formatarErro(error));
    await atualizar();
  }
  const { dados } = useCarregar("pluggy_itens", () => buscarTodos<ItemPluggy>("pluggy_itens", casa.id));

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
      <Erro mensagem={bancos.erro} />
      <div className="mb-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
        <Interruptor rotulo="Aplicar regras aprendidas automaticamente" marcado={casa.aplicar_regras_auto} aoMudar={mudarRegrasAuto} />
        <p className="text-xs text-slate-500">
          Transações que batem com uma regra aprendida são confirmadas sem passar pela caixa de entrada. Elas aparecem no histórico da
          caixa, com opção de desfazer.
        </p>
        <Erro mensagem={erroRegra} />
      </div>
      {bancos.resumo && !bancos.sincronizando && (
        <p role="status" className="mb-2 text-sm text-emerald-700 dark:text-emerald-400">
          Sincronizado: {bancos.resumo.novas} novas na caixa de entrada, {bancos.resumo.jaImportadas} já importadas por arquivo,{" "}
          {bancos.resumo.cartao} de cartão
          {bancos.automaticas ? `, ${bancos.automaticas} confirmadas por regra` : ""}.
          {bancos.resumo.erros.length > 0 && ` ${bancos.resumo.erros.length} banco(s) com erro.`}
        </p>
      )}
      {!dados?.length ? (
        <p className="text-sm text-slate-500">Nenhum banco sincronizado ainda. Toque em “Sincronizar agora”.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {dados.map((i) => (
            <li key={i.id} className="py-2">
              <p className="font-medium">
                {i.banco ?? "Banco"} · {nomeDono(i.dono_membro_id)}
              </p>
              <p className="text-xs text-slate-500">
                {i.ultima_sincronizacao
                  ? `Última sincronização ${formatarData(i.ultima_sincronizacao.slice(0, 10))}`
                  : "Ainda não sincronizado"}
                {i.consent_expires_at && ` · autorização até ${formatarData(i.consent_expires_at.slice(0, 10))}`}
              </p>
              {i.ultimo_erro && <p className="text-xs text-red-600">{i.ultimo_erro}</p>}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}
