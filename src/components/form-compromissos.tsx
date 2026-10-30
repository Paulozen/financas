"use client";

import { useState } from "react";
import { criarCartao } from "@/lib/cartoes";
import { hojeISO } from "@/lib/datas";
import { checar } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { Cartao as TCartao, Contrato, Divida } from "@/lib/tipos";
import { useApp } from "./app-contexto";
import { SeletorCategoria, SeletorDono } from "./ocorrencias";
import { AreaTexto, Botao, Campo, CampoValor, Erro, formatarErro, Modal } from "./ui";

function categoriaPorNome(categorias: { id: string; nome: string; tipo: string }[], nome: string) {
  return categorias.find((c) => c.tipo === "saida" && c.nome === nome)?.id ?? "";
}

function diaValido(dia: string) {
  const d = Number(dia);
  return Number.isInteger(d) && d >= 1 && d <= 31 ? d : null;
}

export function FormContrato({ contrato, aoFechar }: { contrato?: Contrato; aoFechar: () => void }) {
  const { casa, categorias, membros, sincronizar } = useApp();
  const [nome, setNome] = useState(contrato?.nome ?? "");
  const [credor, setCredor] = useState(contrato?.credor ?? "");
  const [valorTotal, setValorTotal] = useState(contrato?.valor_total ?? 0);
  const [numParcelas, setNumParcelas] = useState(String(contrato?.num_parcelas ?? ""));
  const [valorParcela, setValorParcela] = useState(contrato?.valor_parcela ?? 0);
  const [dia, setDia] = useState(String(contrato?.dia ?? ""));
  const [primeira, setPrimeira] = useState(contrato?.primeira_parcela ?? hojeISO());
  const [pagasAntes, setPagasAntes] = useState(String(contrato?.parcelas_pagas_antes ?? 0));
  const [pagoAntes, setPagoAntes] = useState(contrato?.valor_pago_antes ?? 0);
  const [dono, setDono] = useState(contrato?.dono_membro_id ?? "");
  const [categoria, setCategoria] = useState(contrato?.categoria_id ?? categoriaPorNome(categorias, "Moradia"));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const n = Number(numParcelas);
    const pa = Number(pagasAntes || 0);
    const d = diaValido(dia || primeira.slice(8, 10));
    if (!nome.trim()) return setErro("Informe o nome.");
    if (!Number.isInteger(n) || n < 1) return setErro("Número de parcelas inválido.");
    if (!Number.isInteger(pa) || pa < 0 || pa > n) return setErro("Parcelas já pagas deve ser entre 0 e o total.");
    if (!d) return setErro("Dia de vencimento deve ser entre 1 e 31.");
    if (!primeira) return setErro("Informe a data da primeira parcela.");
    const dados = {
      casa_id: casa.id,
      nome: nome.trim(),
      credor: credor.trim() || null,
      valor_total: valorTotal,
      num_parcelas: n,
      valor_parcela: valorParcela,
      dia: d,
      primeira_parcela: primeira,
      parcelas_pagas_antes: pa,
      valor_pago_antes: pagoAntes,
      dono_membro_id: dono || null,
      categoria_id: categoria || null,
    };
    setSalvando(true);
    try {
      const sb = supabase();
      if (contrato) checar(await sb.from("contratos").update(dados).eq("id", contrato.id));
      else checar(await sb.from("contratos").insert(dados));
      await sincronizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={contrato ? "Editar parcelado" : "Novo parcelado"}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Campo rotulo="Nome" placeholder="Ex.: Apartamento" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Campo rotulo="Credor" placeholder="Ex.: Construtora" value={credor} onChange={(e) => setCredor(e.target.value)} />
        <CampoValor rotulo="Valor total" valor={valorTotal} aoMudar={setValorTotal} />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Nº de parcelas" type="number" inputMode="numeric" min={1} value={numParcelas} onChange={(e) => setNumParcelas(e.target.value)} />
          <Campo rotulo="Dia do vencimento" type="number" inputMode="numeric" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
        <CampoValor rotulo="Valor estimado da parcela" valor={valorParcela} aoMudar={setValorParcela} dica="Ao pagar, você informa o valor real (reajustes como INCC ou SAC)." />
        <Campo rotulo="Data da primeira parcela" type="date" value={primeira} onChange={(e) => setPrimeira(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Parcelas já pagas" type="number" inputMode="numeric" min={0} value={pagasAntes} onChange={(e) => setPagasAntes(e.target.value)} dica="Antes de usar o app" />
          <CampoValor rotulo="Valor já pago" valor={pagoAntes} aoMudar={setPagoAntes} />
        </div>
        <SeletorDono valor={dono} aoMudar={setDono} membros={membros} />
        <SeletorCategoria tipo="saida" valor={categoria} aoMudar={setCategoria} categorias={categorias} />
        <Erro mensagem={erro} />
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </form>
    </Modal>
  );
}

export function FormDivida({ divida, aoFechar }: { divida?: Divida; aoFechar: () => void }) {
  const { casa, categorias, membros, sincronizar } = useApp();
  const [descricao, setDescricao] = useState(divida?.descricao ?? "");
  const [credor, setCredor] = useState(divida?.credor ?? "");
  const [valorTotal, setValorTotal] = useState(divida?.valor_total ?? 0);
  const [inicio, setInicio] = useState(divida?.inicio ?? hojeISO());
  const [meta, setMeta] = useState(divida?.meta_mensal ?? 0);
  const [dono, setDono] = useState(divida?.dono_membro_id ?? "");
  const [categoria, setCategoria] = useState(divida?.categoria_id ?? categoriaPorNome(categorias, "Dívidas"));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!descricao.trim()) return setErro("Informe a descrição.");
    if (valorTotal <= 0) return setErro("Informe o valor total.");
    const dados = {
      casa_id: casa.id,
      descricao: descricao.trim(),
      credor: credor.trim() || null,
      valor_total: valorTotal,
      inicio,
      meta_mensal: meta > 0 ? meta : null,
      dono_membro_id: dono || null,
      categoria_id: categoria || null,
    };
    setSalvando(true);
    try {
      const sb = supabase();
      if (divida) checar(await sb.from("dividas").update(dados).eq("id", divida.id));
      else checar(await sb.from("dividas").insert(dados));
      await sincronizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={divida ? "Editar dívida" : "Nova dívida"}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Campo rotulo="Descrição" placeholder="Ex.: Carro" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <Campo rotulo="Credor" value={credor} onChange={(e) => setCredor(e.target.value)} />
        <CampoValor rotulo="Valor total" valor={valorTotal} aoMudar={setValorTotal} />
        <Campo rotulo="Data de início" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        <CampoValor
          rotulo="Meta mensal (opcional)"
          valor={meta}
          aoMudar={setMeta}
          dica="Se preenchida, entra na projeção todo mês. Pagamentos avulsos do mês abatem a meta."
        />
        <SeletorDono valor={dono} aoMudar={setDono} membros={membros} />
        <SeletorCategoria tipo="saida" valor={categoria} aoMudar={setCategoria} categorias={categorias} />
        <Erro mensagem={erro} />
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </form>
    </Modal>
  );
}

export function FormPagamentoDivida({ divida, aoFechar }: { divida: Divida; aoFechar: () => void }) {
  const { casa, sincronizar } = useApp();
  const [valor, setValor] = useState(divida.meta_mensal ?? 0);
  const [data, setData] = useState(hojeISO());
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (valor <= 0) return setErro("Informe o valor.");
    setSalvando(true);
    try {
      checar(
        await supabase()
          .from("ocorrencias")
          .insert({
            casa_id: casa.id,
            origem_tipo: "pagamento_divida",
            origem_id: divida.id,
            descricao: `Pagamento: ${divida.descricao}`,
            tipo: "saida",
            dono_membro_id: divida.dono_membro_id,
            categoria_id: divida.categoria_id,
            valor_previsto: valor,
            valor_real: valor,
            vencimento: data,
            pago_em: data,
            status: "pago",
            observacao: obs.trim() || null,
          }),
      );
      await sincronizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Registrar pagamento">
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <CampoValor rotulo="Valor" valor={valor} aoMudar={setValor} autoFocus />
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <AreaTexto rotulo="Observação" value={obs} onChange={(e) => setObs(e.target.value)} />
        <Erro mensagem={erro} />
        <Botao type="submit" carregando={salvando}>
          Registrar
        </Botao>
      </form>
    </Modal>
  );
}

export function FormCartao({ cartao, aoFechar }: { cartao?: TCartao; aoFechar: () => void }) {
  const { casa, categorias, membros, sincronizar } = useApp();
  const [nome, setNome] = useState(cartao?.nome ?? "");
  const [dono, setDono] = useState(cartao?.dono_membro_id ?? "");
  const [venc, setVenc] = useState(String(cartao?.dia_vencimento ?? ""));
  const [fech, setFech] = useState(cartao?.dia_fechamento ? String(cartao.dia_fechamento) : "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const dv = diaValido(venc);
    const df = fech ? diaValido(fech) : null;
    if (!nome.trim()) return setErro("Informe o nome do cartão.");
    if (!dv) return setErro("Dia de vencimento deve ser entre 1 e 31.");
    if (fech && !df) return setErro("Dia de fechamento deve ser entre 1 e 31.");
    setSalvando(true);
    try {
      const sb = supabase();
      const dados = { casa_id: casa.id, nome: nome.trim(), dono_membro_id: dono || null, dia_vencimento: dv, dia_fechamento: df };
      const regra = { descricao: `Fatura ${nome.trim()}`, dono_membro_id: dono || null, dia: dv };
      if (cartao) {
        checar(await sb.from("cartoes").update(dados).eq("id", cartao.id));
        checar(await sb.from("recorrencias").update(regra).eq("cartao_id", cartao.id));
      } else {
        await criarCartao(casa.id, categorias, { nome: nome.trim(), dono_membro_id: dono || null, dia_vencimento: dv, dia_fechamento: df });
      }
      await sincronizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={cartao ? "Editar cartão" : "Novo cartão"}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Campo rotulo="Nome" placeholder="Ex.: Nubank" value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Dia do vencimento" type="number" inputMode="numeric" min={1} max={31} value={venc} onChange={(e) => setVenc(e.target.value)} />
          <Campo rotulo="Fechamento (opcional)" type="number" inputMode="numeric" min={1} max={31} value={fech} onChange={(e) => setFech(e.target.value)} />
        </div>
        <SeletorDono valor={dono} aoMudar={setDono} membros={membros} />
        <p className="text-xs text-slate-500">
          O app cria a despesa variável “Fatura {nome || "…"}” com uma ocorrência por mês. Ajuste o valor quando a fatura fechar.
        </p>
        <Erro mensagem={erro} />
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </form>
    </Modal>
  );
}
