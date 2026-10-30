"use client";

import { useState } from "react";
import { hojeISO } from "@/lib/datas";
import { checar } from "@/lib/db";
import { formatarReais } from "@/lib/dinheiro";
import { dividirParcelas, TIPOS_ITEM } from "@/lib/projetos";
import { supabase } from "@/lib/supabase";
import type { Projeto, ProjetoItem, StatusItem } from "@/lib/tipos";
import { useApp } from "./app-contexto";
import { SeletorDono } from "./ocorrencias";
import { Abas, AreaTexto, Botao, Campo, CampoValor, Erro, formatarErro, Modal, Selecao } from "./ui";

export function FormProjeto({ projeto, aoFechar }: { projeto?: Projeto; aoFechar: () => void }) {
  const { casa, membros, atualizar } = useApp();
  const [nome, setNome] = useState(projeto?.nome ?? "");
  const [data, setData] = useState(projeto?.data_evento ?? "");
  const [orcamento, setOrcamento] = useState(projeto?.orcamento ?? 0);
  const [dono, setDono] = useState(projeto?.dono_membro_id ?? "");
  const [status, setStatus] = useState(projeto?.status ?? "ativo");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return setErro("Informe o nome.");
    setSalvando(true);
    try {
      const dados = { casa_id: casa.id, nome: nome.trim(), data_evento: data || null, orcamento, dono_membro_id: dono || null, status };
      const sb = supabase();
      if (projeto) checar(await sb.from("projetos").update(dados).eq("id", projeto.id));
      else checar(await sb.from("projetos").insert(dados));
      await atualizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={projeto ? "Editar projeto" : "Novo projeto"}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Campo rotulo="Nome" placeholder="Ex.: Casamento" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Campo rotulo="Data do evento" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <CampoValor rotulo="Orçamento total" valor={orcamento} aoMudar={setOrcamento} />
        <SeletorDono valor={dono} aoMudar={setDono} membros={membros} />
        {projeto && (
          <Selecao
            rotulo="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Projeto["status"])}
            opcoes={[
              { valor: "ativo", rotulo: "Ativo" },
              { valor: "concluido", rotulo: "Concluído" },
              { valor: "cancelado", rotulo: "Cancelado" },
            ]}
          />
        )}
        <Erro mensagem={erro} />
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </form>
    </Modal>
  );
}

export function FormItem({ projeto, item, aoFechar }: { projeto: Projeto; item?: ProjetoItem; aoFechar: () => void }) {
  const { casa, atualizar } = useApp();
  const [descricao, setDescricao] = useState(item?.descricao ?? "");
  const [fornecedor, setFornecedor] = useState(item?.fornecedor ?? "");
  const [tipoItem, setTipoItem] = useState(item?.tipo_item ?? "");
  const [orcado, setOrcado] = useState(item?.valor_orcado ?? 0);
  const [contratado, setContratado] = useState(item?.valor_contratado ?? 0);
  const [contato, setContato] = useState(item?.contato ?? "");
  const [obs, setObs] = useState(item?.observacoes ?? "");
  const [status, setStatus] = useState<StatusItem>(item?.status ?? "orçando");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim()) return setErro("Informe a descrição.");
    setSalvando(true);
    try {
      const dados = {
        casa_id: casa.id,
        projeto_id: projeto.id,
        descricao: descricao.trim(),
        fornecedor: fornecedor.trim() || null,
        tipo_item: tipoItem.trim() || null,
        valor_orcado: orcado,
        valor_contratado: contratado,
        contato: contato.trim() || null,
        observacoes: obs.trim() || null,
        status,
      };
      const sb = supabase();
      if (item) checar(await sb.from("projeto_itens").update(dados).eq("id", item.id));
      else checar(await sb.from("projeto_itens").insert(dados));
      await atualizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={item ? "Editar item" : "Novo item"}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Campo rotulo="Descrição" placeholder="Ex.: Buffet completo" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <Campo rotulo="Fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
        <Campo rotulo="Tipo do item" list="tipos-item" value={tipoItem} onChange={(e) => setTipoItem(e.target.value)} />
        <datalist id="tipos-item">
          {TIPOS_ITEM.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <div className="grid grid-cols-2 gap-3">
          <CampoValor rotulo="Orçado" valor={orcado} aoMudar={setOrcado} />
          <CampoValor rotulo="Contratado" valor={contratado} aoMudar={setContratado} />
        </div>
        <Selecao
          rotulo="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusItem)}
          opcoes={[
            { valor: "orçando", rotulo: "Orçando" },
            { valor: "contratado", rotulo: "Contratado" },
            { valor: "quitado", rotulo: "Quitado" },
          ]}
        />
        <Campo rotulo="Contato" placeholder="Telefone, Instagram..." value={contato} onChange={(e) => setContato(e.target.value)} />
        <AreaTexto rotulo="Observações" value={obs} onChange={(e) => setObs(e.target.value)} />
        <Erro mensagem={erro} />
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </form>
    </Modal>
  );
}

/** Adiciona uma parcela ou gera N parcelas iguais para um item. */
export function FormParcelas({
  projeto,
  item,
  sugestao,
  aoFechar,
}: {
  projeto: Projeto;
  item: ProjetoItem;
  /** valor ainda sem parcela (contratado − já agendado) */
  sugestao: number;
  aoFechar: () => void;
}) {
  const { casa, categorias, sincronizar } = useApp();
  const [modo, setModo] = useState<"iguais" | "uma">("iguais");
  const [total, setTotal] = useState(Math.max(0, sugestao));
  const [n, setN] = useState("1");
  const [primeira, setPrimeira] = useState(hojeISO());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const qtd = modo === "uma" ? 1 : Math.max(0, Math.floor(Number(n) || 0));
  const previa = dividirParcelas(total, qtd, primeira || hojeISO());

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!previa.length) return setErro("Informe valor e número de parcelas.");
    if (qtd > 120) return setErro("No máximo 120 parcelas.");
    setSalvando(true);
    try {
      const categoria = categorias.find((c) => c.tipo === "saida" && c.nome === "Casamento")?.id ?? null;
      const nome = item.fornecedor ? `${item.descricao} (${item.fornecedor})` : item.descricao;
      checar(
        await supabase()
          .from("ocorrencias")
          .insert(
            previa.map((p, i) => ({
              casa_id: casa.id,
              origem_tipo: "parcela_projeto",
              origem_id: item.id,
              descricao: previa.length > 1 ? `${nome} ${i + 1}/${previa.length}` : nome,
              tipo: "saida",
              dono_membro_id: projeto.dono_membro_id,
              categoria_id: categoria,
              valor_previsto: p.valor,
              vencimento: p.data,
              status: "pendente",
            })),
          ),
      );
      await sincronizar();
      aoFechar();
    } catch (e) {
      setErro(formatarErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Parcelas: ${item.descricao}`}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Abas
          abas={[
            { valor: "iguais", rotulo: "N parcelas iguais" },
            { valor: "uma", rotulo: "Uma parcela" },
          ]}
          atual={modo}
          aoMudar={setModo}
        />
        <CampoValor rotulo={modo === "uma" ? "Valor" : "Valor total a parcelar"} valor={total} aoMudar={setTotal} />
        {modo === "iguais" && (
          <Campo rotulo="Número de parcelas" type="number" inputMode="numeric" min={1} max={120} value={n} onChange={(e) => setN(e.target.value)} />
        )}
        <Campo rotulo={modo === "uma" ? "Data" : "Data da primeira"} type="date" value={primeira} onChange={(e) => setPrimeira(e.target.value)} />
        {previa.length > 1 && (
          <p className="text-sm text-slate-500">
            {previa.length}× de {formatarReais(previa[0].valor)}
            {previa.at(-1)!.valor !== previa[0].valor && ` (última ${formatarReais(previa.at(-1)!.valor)})`}, todo dia {primeira.slice(8, 10)}.
          </p>
        )}
        <Erro mensagem={erro} />
        <Botao type="submit" carregando={salvando}>
          Criar {previa.length > 1 ? `${previa.length} parcelas` : "parcela"}
        </Botao>
      </form>
    </Modal>
  );
}
