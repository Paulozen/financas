"use client";

import { useState } from "react";
import { removerFuturasPendentes } from "@/lib/acoes";
import { hojeISO } from "@/lib/datas";
import { useApp } from "./app-contexto";
import { Botao, Erro, formatarErro, Modal } from "./ui";

/**
 * Confirmação de exclusão de uma regra que gera ocorrências: pergunta se as
 * ocorrências futuras pendentes também devem ser removidas.
 */
export function ModalExcluirRegra({
  nome,
  origemId,
  excluir,
  aoFechar,
  aoConcluir,
}: {
  nome: string;
  /** id usado em ocorrencias.origem_id */
  origemId: string;
  excluir: () => Promise<void>;
  aoFechar: () => void;
  aoConcluir?: () => void;
}) {
  const { sincronizar } = useApp();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(removerFuturas: boolean) {
    setOcupado(true);
    setErro(null);
    try {
      if (removerFuturas) await removerFuturasPendentes(origemId, hojeISO());
      await excluir();
      await sincronizar();
      aoFechar();
      aoConcluir?.();
    } catch (e) {
      setErro(formatarErro(e));
      setOcupado(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Excluir “${nome}”?`}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          O que fazer com as ocorrências futuras ainda pendentes? As já pagas são mantidas no histórico.
        </p>
        <Botao variante="perigo" carregando={ocupado} onClick={() => executar(true)}>
          Excluir e remover as futuras pendentes
        </Botao>
        <Botao variante="secundario" carregando={ocupado} onClick={() => executar(false)}>
          Excluir e manter as ocorrências
        </Botao>
        <Botao variante="fantasma" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Erro mensagem={erro} />
      </div>
    </Modal>
  );
}
