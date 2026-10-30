"use client";

import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp, useCarregar } from "@/components/app-contexto";
import { ModalExcluirRegra } from "@/components/excluir";
import { FormDivida, FormPagamentoDivida } from "@/components/form-compromissos";
import { LinhaOcorrencia, ModalOcorrencia, ModalPagar } from "@/components/ocorrencias";
import { Barra, Botao, Cartao, Carregando, Dinheiro, Erro, Selo, Titulo, Vazio } from "@/components/ui";
import { resumoDivida } from "@/lib/compromissos";
import { formatarData, hojeISO, mesDe } from "@/lib/datas";
import { checar } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { supabase } from "@/lib/supabase";
import type { Divida, Ocorrencia } from "@/lib/tipos";

export default function DetalheDivida() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { nomeDono } = useApp();
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [pagamento, setPagamento] = useState(false);
  const [aberta, setAberta] = useState<Ocorrencia | null>(null);
  const [pagando, setPagando] = useState<Ocorrencia | null>(null);

  const { dados, erro, carregando } = useCarregar(`divida:${id}`, async () => {
    const sb = supabase();
    const [divida, ocorrencias] = await Promise.all([
      sb.from("dividas").select("*").eq("id", id).maybeSingle().then(checar),
      sb.from("ocorrencias").select("*").eq("origem_id", id).order("vencimento").then(checar),
    ]);
    return { divida: divida as Divida | null, ocorrencias: ocorrencias as Ocorrencia[] };
  });

  if (carregando && !dados) return <Carregando />;
  if (erro) return <Erro mensagem={erro} />;
  const d = dados?.divida;
  if (!d) return <p>Dívida não encontrada.</p>;
  const r = resumoDivida(d, dados.ocorrencias);
  const metaMes = dados.ocorrencias.find((o) => o.origem_tipo === "meta_divida" && mesDe(o.vencimento) === mesDe(hojeISO()));

  return (
    <>
      <Link href="/compromissos" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500">
        <ArrowLeft className="size-4" /> Compromissos
      </Link>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-bold">{d.descricao}</h1>
        {r.quitada && <Selo cor="verde">concluída</Selo>}
      </div>
      <p className="mb-4 text-sm text-slate-500">
        {d.credor} · {nomeDono(d.dono_membro_id)} · desde {formatarData(d.inicio)}
      </p>

      <Cartao className="mb-4">
        <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500">Falta pagar</p>
            <Dinheiro valor={r.restante} className="text-lg font-semibold" />
          </div>
          <div>
            <p className="text-slate-500">Quitado</p>
            <p className="text-lg font-semibold">{r.percentual}%</p>
          </div>
        </div>
        <Barra valor={r.pago} total={d.valor_total} />
        <p className="mt-1 text-xs text-slate-500">
          Pago {formatarReais(r.pago)} de {formatarReais(d.valor_total)}
        </p>
        {d.meta_mensal && metaMes && !r.quitada && (
          <p className="mt-2 text-sm">
            Meta do mês ({formatarReais(d.meta_mensal)}):{" "}
            {metaMes.status === "pago" ? (
              <Selo cor="verde">cumprida</Selo>
            ) : (
              <>falta {formatarReais(metaMes.valor_previsto)}</>
            )}
          </p>
        )}
      </Cartao>

      {!r.quitada && (
        <Botao className="mb-4 w-full" onClick={() => setPagamento(true)}>
          <Plus className="size-4" /> Registrar pagamento
        </Botao>
      )}

      <Cartao className="mb-4">
        <Titulo>Histórico de pagamentos</Titulo>
        {r.pagamentos.length === 0 ? (
          <Vazio titulo="Nenhum pagamento ainda" />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {r.pagamentos.map((o) => (
              <LinhaOcorrencia key={o.id} o={o} aoAbrir={() => setAberta(o)} aoPagar={() => setPagando(o)} />
            ))}
          </ul>
        )}
      </Cartao>

      <div className="flex gap-2">
        <Botao variante="secundario" className="flex-1" onClick={() => setEditando(true)}>
          Editar
        </Botao>
        <Botao variante="fantasma" className="flex-1 text-red-600" onClick={() => setExcluindo(true)}>
          Excluir
        </Botao>
      </div>

      {pagamento && <FormPagamentoDivida divida={d} aoFechar={() => setPagamento(false)} />}
      {editando && <FormDivida divida={d} aoFechar={() => setEditando(false)} />}
      {excluindo && (
        <ModalExcluirRegra
          nome={d.descricao}
          origemId={d.id}
          excluir={async () => {
            checar(await supabase().from("dividas").delete().eq("id", d.id));
          }}
          aoFechar={() => setExcluindo(false)}
          aoConcluir={() => router.push("/compromissos")}
        />
      )}
      <ModalOcorrencia o={aberta} aoFechar={() => setAberta(null)} aoPagar={setPagando} />
      <ModalPagar o={pagando} aoFechar={() => setPagando(null)} />
    </>
  );
}
