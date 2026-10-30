"use client";

import { RefreshCw } from "lucide-react";
import { formatarData } from "@/lib/datas";
import { buscarTodos } from "@/lib/db";
import { useApp, useCarregar } from "./app-contexto";
import { Botao, Cartao, Erro, Titulo } from "./ui";

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
  const { casa, bancos, sincronizarBancos, nomeDono } = useApp();
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
      {bancos.resumo && !bancos.sincronizando && (
        <p role="status" className="mb-2 text-sm text-emerald-700 dark:text-emerald-400">
          Sincronizado: {bancos.resumo.novas} novas na caixa de entrada, {bancos.resumo.jaImportadas} já importadas por arquivo, {bancos.resumo.cartao} de
          cartão
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
                {i.ultima_sincronizacao ? `Última sincronização ${formatarData(i.ultima_sincronizacao.slice(0, 10))}` : "Ainda não sincronizado"}
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
