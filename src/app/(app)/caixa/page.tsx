"use client";

import { RefreshCw, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp, useCarregar } from "@/components/app-contexto";
import { Cabecalho } from "@/components/cabecalho";
import { Previa } from "@/components/importar/previa";
import { Abas, Botao, Cartao, Carregando, Dinheiro, Erro, formatarErro, Selo, Vazio } from "@/components/ui";
import { carregarCaixa, confirmarCaixa, desfazerConfirmacao, type LinhaCaixa, type TransacaoExterna } from "@/lib/caixa-entrada";
import { formatarData, hojeISO, somarDias } from "@/lib/datas";
import { buscarTodos } from "@/lib/db";

const ROTULO: Record<string, string> = { novo: "Novo lançamento", vincular: "Vinculado", racha: "Racha", ignorar: "Ignorado" };

export default function CaixaDeEntrada() {
  const [aba, setAba] = useState<"revisar" | "historico">("revisar");
  const { bancos, sincronizarBancos } = useApp();
  return (
    <>
      <Cabecalho
        titulo="Caixa de entrada"
        semVisao
        acao={
          <Botao variante="secundario" carregando={bancos.sincronizando} onClick={() => sincronizarBancos().catch(() => {})}>
            <RefreshCw className="size-4" aria-hidden /> Sincronizar
          </Botao>
        }
      />
      <Erro mensagem={bancos.erro} />
      <Abas
        abas={[
          { valor: "revisar", rotulo: "A revisar" },
          { valor: "historico", rotulo: "Histórico" },
        ]}
        atual={aba}
        aoMudar={setAba}
      />
      {aba === "revisar" ? <Revisar /> : <Historico />}
    </>
  );
}

function Revisar() {
  const { casa, membro, categorias, sincronizar, versao } = useApp();
  const { dados, erro, carregando } = useCarregar("caixa", () => carregarCaixa(casa, categorias));

  if (carregando && !dados) return <Carregando />;
  if (erro) return <Erro mensagem={erro} />;
  if (!dados?.linhas.length)
    return (
      <Vazio
        titulo="Nada para revisar"
        texto="As transações das contas correntes conectadas aparecem aqui depois de cada sincronização (a Pluggy atualiza os bancos a cada 24 horas)."
        acao={
          <Link href="/configuracoes" className="text-sm font-medium text-marca-600 dark:text-marca-400">
            Ver bancos conectados
          </Link>
        }
      />
    );

  return (
    <Previa
      key={versao}
      caixa
      nome="Transações das contas conectadas"
      linhasIniciais={dados.linhas}
      pendentes={dados.pendentes}
      descartadas={0}
      detalhe={(l) => (l as LinhaCaixa).conta?.nome ?? ""}
      aoConfirmar={async (linhas) => {
        await confirmarCaixa(casa, membro, linhas);
        await sincronizar();
      }}
    />
  );
}

function Historico() {
  const { casa, sincronizar } = useApp();
  const [erro, setErro] = useState<string | null>(null);
  const [desfazendo, setDesfazendo] = useState<string | null>(null);
  const { dados, carregando } = useCarregar("caixa-historico", () =>
    buscarTodos<TransacaoExterna>(
      "transacoes_externas",
      casa.id,
      (q) => q.eq("situacao", "confirmada").gte("data", somarDias(hojeISO(), -120)),
      "confirmada_em",
    ),
  );
  const lista = [...(dados ?? [])].reverse();

  async function desfazer(t: TransacaoExterna) {
    setErro(null);
    setDesfazendo(t.id);
    try {
      await desfazerConfirmacao(t.id);
      await sincronizar();
    } catch (e) {
      setErro(formatarErro(e));
    } finally {
      setDesfazendo(null);
    }
  }

  if (carregando && !dados) return <Carregando />;
  if (!lista.length) return <Vazio titulo="Nenhuma transação confirmada ainda" />;
  return (
    <Cartao>
      <p className="mb-2 text-xs text-slate-500">
        Transações confirmadas pela caixa de entrada ou automaticamente por regra aprendida. Desfazer devolve à caixa.
      </p>
      <Erro mensagem={erro} />
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {lista.map((t) => (
          <li key={t.id} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.descricao}</p>
              <p className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                {formatarData(t.data)} · {ROTULO[t.acao ?? ""] ?? t.acao}
                {t.automatica && <Selo cor="azul">automática</Selo>}
              </p>
            </div>
            <Dinheiro valor={t.valor} sinal className="text-sm font-semibold" />
            <Botao
              variante="fantasma"
              className="!min-h-9 !px-2"
              carregando={desfazendo === t.id}
              onClick={() => desfazer(t)}
              aria-label={`Desfazer ${t.descricao}`}
            >
              <Undo2 className="size-4" aria-hidden /> Desfazer
            </Botao>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}
