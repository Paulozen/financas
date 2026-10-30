"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp, useCarregar } from "@/components/app-contexto";
import { ModalExcluirRegra } from "@/components/excluir";
import { FormContrato } from "@/components/form-compromissos";
import { LinhaOcorrencia, ModalOcorrencia, ModalPagar } from "@/components/ocorrencias";
import { Barra, Botao, Cartao, Carregando, Dinheiro, Erro, Titulo } from "@/components/ui";
import { resumoContrato } from "@/lib/compromissos";
import { checar } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { Contrato, Ocorrencia } from "@/lib/tipos";

export default function DetalheParcelado() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { nomeDono } = useApp();
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [aberta, setAberta] = useState<Ocorrencia | null>(null);
  const [pagando, setPagando] = useState<Ocorrencia | null>(null);

  const { dados, erro, carregando } = useCarregar(`contrato:${id}`, async () => {
    const sb = supabase();
    const [contrato, ocorrencias] = await Promise.all([
      sb.from("contratos").select("*").eq("id", id).maybeSingle().then(checar),
      sb.from("ocorrencias").select("*").eq("origem_id", id).eq("origem_tipo", "parcela_contrato").order("parcela_num").then(checar),
    ]);
    return { contrato: contrato as Contrato | null, ocorrencias: ocorrencias as Ocorrencia[] };
  });

  if (carregando && !dados) return <Carregando />;
  if (erro) return <Erro mensagem={erro} />;
  const c = dados?.contrato;
  if (!c) return <p>Parcelado não encontrado.</p>;
  const r = resumoContrato(c, dados.ocorrencias);
  const geradasAte = r.parcelas.at(-1)?.parcela_num ?? c.parcelas_pagas_antes;

  return (
    <>
      <Link href="/compromissos" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500">
        <ArrowLeft className="size-4" /> Compromissos
      </Link>
      <h1 className="mb-1 text-xl font-bold">{c.nome}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {c.credor} · {nomeDono(c.dono_membro_id)} · vence dia {c.dia}
      </p>

      <Cartao className="mb-4">
        <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500">Parcelas pagas</p>
            <p className="font-semibold">
              {r.pagas} de {c.num_parcelas}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Restantes</p>
            <p className="font-semibold">{r.restantes}</p>
          </div>
          <div>
            <p className="text-slate-500">Total pago</p>
            <Dinheiro valor={r.totalPago} className="font-semibold" />
          </div>
          <div>
            <p className="text-slate-500">Saldo devedor estimado</p>
            <Dinheiro valor={r.saldoDevedor} className="font-semibold" />
          </div>
        </div>
        <Barra valor={r.totalPago} total={c.valor_total} />
        <p className="mt-1 text-xs text-slate-500">
          Valor total <Dinheiro valor={c.valor_total} /> · parcela estimada <Dinheiro valor={c.valor_parcela} />
        </p>
      </Cartao>

      <Cartao className="mb-4">
        <Titulo>Parcelas</Titulo>
        {c.parcelas_pagas_antes > 0 && (
          <p className="mb-2 text-xs text-slate-500">
            1 a {c.parcelas_pagas_antes}: pagas antes de usar o app (<Dinheiro valor={c.valor_pago_antes} />).
          </p>
        )}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {r.parcelas.map((o) => (
            <LinhaOcorrencia key={o.id} o={o} aoAbrir={() => setAberta(o)} aoPagar={() => setPagando(o)} />
          ))}
        </ul>
        {geradasAte < c.num_parcelas && (
          <p className="mt-2 text-xs text-slate-500">
            Parcelas {geradasAte + 1} a {c.num_parcelas} aparecem automaticamente conforme os meses chegam (o app gera 12 meses à frente).
          </p>
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

      {editando && <FormContrato contrato={c} aoFechar={() => setEditando(false)} />}
      {excluindo && (
        <ModalExcluirRegra
          nome={c.nome}
          origemId={c.id}
          excluir={async () => {
            checar(await supabase().from("contratos").delete().eq("id", c.id));
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
