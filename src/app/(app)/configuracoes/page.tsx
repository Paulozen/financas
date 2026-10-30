"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-contexto";
import { Cabecalho } from "@/components/cabecalho";
import { Botao, Campo, CampoValor, Cartao, Erro, formatarErro, Interruptor, Selecao, Titulo } from "@/components/ui";
import { hojeISO } from "@/lib/datas";
import { checar } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export default function Configuracoes() {
  const { casa, membro, membros, atualizar } = useApp();
  const [nome, setNome] = useState(membro.nome);
  const [nomeCasa, setNomeCasa] = useState(casa.nome);
  const [temSaldo, setTemSaldo] = useState(casa.saldo_conta !== null);
  const [saldo, setSaldo] = useState(casa.saldo_conta ?? 0);
  const [saldoData, setSaldoData] = useState(casa.saldo_conta_data ?? hojeISO());
  const [rachaAtivo, setRachaAtivo] = useState(casa.racha_ativo);
  const [rachaMembro, setRachaMembro] = useState(casa.racha_membro_id ?? membro.id);
  const [mensalidade, setMensalidade] = useState(casa.racha_mensalidade);
  const [diaria, setDiaria] = useState(casa.racha_diaria);
  const [juiz, setJuiz] = useState(casa.racha_juiz);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);
    if (!nome.trim()) return setErro("Informe seu nome de exibição.");
    setSalvando(true);
    try {
      const sb = supabase();
      if (nome.trim() !== membro.nome) checar(await sb.from("membros").update({ nome: nome.trim() }).eq("id", membro.id));
      checar(
        await sb
          .from("casas")
          .update({
            nome: nomeCasa.trim() || casa.nome,
            saldo_conta: temSaldo ? saldo : null,
            saldo_conta_data: temSaldo ? saldoData : null,
            racha_ativo: rachaAtivo,
            racha_membro_id: rachaAtivo ? rachaMembro : casa.racha_membro_id,
            racha_mensalidade: mensalidade,
            racha_diaria: diaria,
            racha_juiz: juiz,
          })
          .eq("id", casa.id),
      );
      await atualizar();
      setOk("Configurações salvas.");
    } catch (e) {
      setErro(formatarErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Cabecalho titulo="Configurações" semVisao />
      <form onSubmit={salvar} className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Cartao>
          <Titulo>Você e a casa</Titulo>
          <div className="flex flex-col gap-4">
            <Campo rotulo="Seu nome de exibição" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Campo rotulo="Nome da casa" value={nomeCasa} onChange={(e) => setNomeCasa(e.target.value)} />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Código de convite</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded-lg bg-slate-100 px-3 py-2 text-lg tracking-widest dark:bg-slate-800">{casa.codigo_convite}</code>
                <Botao
                  variante="fantasma"
                  onClick={() => {
                    navigator.clipboard?.writeText(casa.codigo_convite);
                    setCopiado(true);
                  }}
                >
                  <Copy className="size-4" /> {copiado ? "Copiado" : "Copiar"}
                </Botao>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {membros.length < 2
                  ? "A outra pessoa usa este código no primeiro acesso."
                  : `Membros: ${membros.map((m) => m.nome).join(" e ")}.`}
              </p>
            </div>
          </div>
        </Cartao>

        <Cartao>
          <Titulo>Saldo em conta</Titulo>
          <div className="flex flex-col gap-4">
            <Interruptor
              rotulo="Informar saldo em conta hoje (mostra o saldo acumulado na projeção)"
              marcado={temSaldo}
              aoMudar={setTemSaldo}
            />
            {temSaldo && (
              <div className="grid grid-cols-2 gap-3">
                <CampoValor rotulo="Saldo" valor={saldo} aoMudar={setSaldo} />
                <Campo rotulo="Data" type="date" value={saldoData} onChange={(e) => setSaldoData(e.target.value)} />
              </div>
            )}
          </div>
        </Cartao>

        <Cartao>
          <Titulo>Caixa do racha</Titulo>
          <div className="flex flex-col gap-4">
            <Interruptor rotulo="Ativar o caixa do racha" marcado={rachaAtivo} aoMudar={setRachaAtivo} />
            {rachaAtivo && (
              <>
                <Selecao
                  rotulo="Quem organiza"
                  value={rachaMembro}
                  onChange={(e) => setRachaMembro(e.target.value)}
                  opcoes={membros.map((m) => ({ valor: m.id, rotulo: m.nome }))}
                />
                <div className="grid grid-cols-3 gap-2">
                  <CampoValor rotulo="Mensalidade" valor={mensalidade} aoMudar={setMensalidade} />
                  <CampoValor rotulo="Diária" valor={diaria} aoMudar={setDiaria} />
                  <CampoValor rotulo="Juiz" valor={juiz} aoMudar={setJuiz} />
                </div>
              </>
            )}
          </div>
        </Cartao>

        <div className="flex flex-col gap-3 lg:col-span-2 lg:max-w-sm">
          <Erro mensagem={erro} />
          {ok && (
            <p role="status" className="text-sm text-emerald-600">
              {ok}
            </p>
          )}
          <Botao type="submit" carregando={salvando}>
            Salvar
          </Botao>
        </div>
      </form>
    </>
  );
}
