"use client";

import { useState } from "react";
import { removerFuturasPendentes } from "@/lib/acoes";
import { hojeISO } from "@/lib/datas";
import { checar } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { CASAL, type Recorrencia, type Tipo } from "@/lib/tipos";
import { useApp } from "./app-contexto";
import { SeletorCategoria, SeletorDono } from "./ocorrencias";
import { Abas, Botao, Campo, CampoValor, Erro, formatarErro, Interruptor, Modal } from "./ui";

/** Dono padrão de um novo registro: o da visão atual (Casal se for a visão Casal). */
export function useDonoPadrao(): string {
  const { visao } = useApp();
  return visao === CASAL ? "" : visao;
}

export function FormRecorrencia({
  regra,
  tipoInicial = "saida",
  aoFechar,
}: {
  regra?: Recorrencia;
  tipoInicial?: Tipo;
  aoFechar: () => void;
}) {
  const { casa, categorias, membros, sincronizar } = useApp();
  const donoPadrao = useDonoPadrao();
  const [tipo, setTipo] = useState<Tipo>(regra?.tipo ?? tipoInicial);
  const [modo, setModo] = useState<"fixa" | "variavel">(regra?.modo ?? "fixa");
  const [descricao, setDescricao] = useState(regra?.descricao ?? "");
  const [valor, setValor] = useState(regra?.valor ?? 0);
  const [media, setMedia] = useState(regra ? !regra.valor_manual : true);
  const [dia, setDia] = useState(String(regra?.dia ?? Number(hojeISO().slice(8, 10))));
  const [inicio, setInicio] = useState(regra?.inicio ?? `${hojeISO().slice(0, 7)}-01`);
  const [fim, setFim] = useState(regra?.fim ?? "");
  const [dono, setDono] = useState(regra ? (regra.dono_membro_id ?? "") : donoPadrao);
  const [categoria, setCategoria] = useState(regra?.categoria_id ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const d = Number(dia);
    if (!descricao.trim()) return setErro("Informe a descrição.");
    if (!Number.isInteger(d) || d < 1 || d > 31) return setErro("Dia do mês deve ser entre 1 e 31.");
    if (!inicio) return setErro("Informe o início.");
    if (fim && fim < inicio) return setErro("O fim deve ser depois do início.");
    const dados = {
      casa_id: casa.id,
      descricao: descricao.trim(),
      tipo,
      modo,
      valor,
      valor_manual: modo === "variavel" ? !media : false,
      dia: d,
      inicio,
      fim: fim || null,
      dono_membro_id: dono || null,
      categoria_id: categoria || null,
    };
    setSalvando(true);
    try {
      const sb = supabase();
      if (regra) checar(await sb.from("recorrencias").update(dados).eq("id", regra.id));
      else checar(await sb.from("recorrencias").insert(dados));
      await sincronizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(removerFuturas: boolean) {
    if (!regra) return;
    setSalvando(true);
    try {
      if (removerFuturas) await removerFuturasPendentes(regra.id, hojeISO());
      checar(await supabase().from("recorrencias").delete().eq("id", regra.id));
      await sincronizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={regra ? "Editar recorrente" : "Nova receita/despesa recorrente"}>
      {excluindo ? (
        <div className="flex flex-col gap-3">
          <p>Excluir “{regra?.descricao}”. O que fazer com as ocorrências futuras ainda pendentes?</p>
          <Botao variante="perigo" carregando={salvando} onClick={() => excluir(true)}>
            Excluir regra e as futuras pendentes
          </Botao>
          <Botao variante="secundario" carregando={salvando} onClick={() => excluir(false)}>
            Excluir só a regra (manter ocorrências)
          </Botao>
          <Botao variante="fantasma" onClick={() => setExcluindo(false)}>
            Cancelar
          </Botao>
          <Erro mensagem={erro} />
        </div>
      ) : (
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <Abas
            abas={[
              { valor: "saida", rotulo: "Despesa" },
              { valor: "entrada", rotulo: "Receita" },
            ]}
            atual={tipo}
            aoMudar={(t) => {
              setTipo(t);
              setCategoria("");
            }}
          />
          <Abas
            abas={[
              { valor: "fixa", rotulo: "Fixa" },
              { valor: "variavel", rotulo: "Variável" },
            ]}
            atual={modo}
            aoMudar={setModo}
          />
          <Campo
            rotulo="Descrição"
            placeholder={tipo === "entrada" ? "Ex.: Salário" : "Ex.: Aluguel"}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <CampoValor
            rotulo={modo === "variavel" ? "Valor estimado" : "Valor"}
            valor={valor}
            aoMudar={setValor}
            dica={modo === "variavel" && media ? "Usado até haver pagamentos; depois vale a média dos últimos 3." : undefined}
          />
          {modo === "variavel" && <Interruptor rotulo="Prever pela média dos últimos 3 pagamentos" marcado={media} aoMudar={setMedia} />}
          <Campo
            rotulo="Dia do mês"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={dia}
            onChange={(e) => setDia(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Início" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            <Campo rotulo="Fim (opcional)" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <SeletorDono valor={dono} aoMudar={setDono} membros={membros} />
          <SeletorCategoria tipo={tipo} valor={categoria} aoMudar={setCategoria} categorias={categorias} />
          {regra && (
            <p className="text-xs text-slate-500">Alterações valem para as ocorrências futuras pendentes; as já pagas não mudam.</p>
          )}
          <Erro mensagem={erro} />
          <Botao type="submit" carregando={salvando}>
            Salvar
          </Botao>
          {regra && (
            <Botao variante="fantasma" className="text-red-600" onClick={() => setExcluindo(true)}>
              Excluir
            </Botao>
          )}
        </form>
      )}
    </Modal>
  );
}

/** Lançamento pontual (acontece uma vez). */
export function FormPontual({ aoFechar }: { aoFechar: () => void }) {
  const { casa, categorias, membros, sincronizar } = useApp();
  const donoPadrao = useDonoPadrao();
  const hoje = hojeISO();
  const [tipo, setTipo] = useState<Tipo>("saida");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(hoje);
  const [pago, setPago] = useState(true);
  const [dono, setDono] = useState(donoPadrao);
  const [categoria, setCategoria] = useState("");
  const [fonte, setFonte] = useState("");
  const [comReserva, setComReserva] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!descricao.trim()) return setErro("Informe a descrição.");
    if (valor <= 0) return setErro("Informe o valor.");
    if (!data) return setErro("Informe a data.");
    setSalvando(true);
    try {
      checar(
        await supabase()
          .from("ocorrencias")
          .insert({
            casa_id: casa.id,
            origem_tipo: "pontual",
            descricao: descricao.trim(),
            tipo,
            dono_membro_id: dono || null,
            categoria_id: categoria || null,
            valor_previsto: valor,
            valor_real: pago ? valor : null,
            vencimento: data,
            pago_em: pago ? data : null,
            status: pago ? "pago" : "pendente",
            fonte: tipo === "entrada" && fonte.trim() ? fonte.trim() : null,
            paga_com_reserva: tipo === "saida" && comReserva,
          }),
      );
      await sincronizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Lançamento rápido">
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Abas
          abas={[
            { valor: "saida", rotulo: "Despesa" },
            { valor: "entrada", rotulo: "Receita" },
          ]}
          atual={tipo}
          aoMudar={(t) => {
            setTipo(t);
            setCategoria("");
          }}
        />
        <CampoValor rotulo="Valor" valor={valor} aoMudar={setValor} autoFocus />
        <Campo rotulo="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        {tipo === "entrada" && (
          <Campo rotulo="Origem (opcional)" placeholder="Ex.: ajuda da mãe" value={fonte} onChange={(e) => setFonte(e.target.value)} />
        )}
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <Interruptor rotulo={tipo === "entrada" ? "Já recebido" : "Já pago"} marcado={pago} aoMudar={setPago} />
        {tipo === "saida" && (
          <Interruptor rotulo="Pago com dinheiro guardado (caixinha/reserva)" marcado={comReserva} aoMudar={setComReserva} />
        )}
        <SeletorDono valor={dono} aoMudar={setDono} membros={membros} />
        <SeletorCategoria tipo={tipo} valor={categoria} aoMudar={setCategoria} categorias={categorias} />
        <Erro mensagem={erro} />
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </form>
    </Modal>
  );
}
