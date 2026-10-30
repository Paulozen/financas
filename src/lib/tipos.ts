// Tipos das linhas do banco (centavos em number).

export type Tipo = "entrada" | "saida";
export type Status = "pendente" | "pago" | "cancelado";
export type OrigemTipo =
  | "recorrencia"
  | "pontual"
  | "parcela_contrato"
  | "pagamento_divida"
  | "meta_divida"
  | "parcela_projeto"
  | "fatura";

export interface Casa {
  id: string;
  nome: string;
  codigo_convite: string;
  saldo_conta: number | null;
  saldo_conta_data: string | null;
  racha_ativo: boolean;
  racha_membro_id: string | null;
  racha_mensalidade: number;
  racha_diaria: number;
  racha_juiz: number;
  aplicar_regras_auto: boolean;
}

export interface Membro {
  id: string;
  casa_id: string;
  user_id: string;
  nome: string;
}

export interface Categoria {
  id: string;
  casa_id: string;
  nome: string;
  tipo: Tipo;
  cor: string;
  ativa: boolean;
  ordem: number;
}

export interface Recorrencia {
  id: string;
  casa_id: string;
  descricao: string;
  tipo: Tipo;
  modo: "fixa" | "variavel";
  valor: number;
  valor_manual: boolean;
  dia: number;
  inicio: string;
  fim: string | null;
  dono_membro_id: string | null;
  categoria_id: string | null;
  cartao_id: string | null;
  ativa: boolean;
  criado_em: string;
}

export interface Contrato {
  id: string;
  casa_id: string;
  nome: string;
  credor: string | null;
  valor_total: number;
  num_parcelas: number;
  valor_parcela: number;
  dia: number;
  primeira_parcela: string;
  parcelas_pagas_antes: number;
  valor_pago_antes: number;
  dono_membro_id: string | null;
  categoria_id: string | null;
}

export interface Divida {
  id: string;
  casa_id: string;
  credor: string | null;
  descricao: string;
  valor_total: number;
  inicio: string;
  meta_mensal: number | null;
  dono_membro_id: string | null;
  categoria_id: string | null;
}

export interface Cartao {
  id: string;
  casa_id: string;
  nome: string;
  dono_membro_id: string | null;
  dia_vencimento: number;
  dia_fechamento: number | null;
  ativo: boolean;
}

export interface Ocorrencia {
  id: string;
  casa_id: string;
  origem_tipo: OrigemTipo;
  origem_id: string | null;
  chave: string | null;
  descricao: string;
  tipo: Tipo;
  dono_membro_id: string | null;
  categoria_id: string | null;
  valor_previsto: number;
  valor_real: number | null;
  previsto_manual: boolean;
  vencimento: string;
  pago_em: string | null;
  status: Status;
  observacao: string | null;
  fonte: string | null;
  parcela_num: number | null;
  transacao_importada_id: string | null;
  /** paga com dinheiro guardado: fica na categoria/projeto, fora da sobra e da projeção */
  paga_com_reserva?: boolean;
}

export interface Projeto {
  id: string;
  casa_id: string;
  nome: string;
  data_evento: string | null;
  orcamento: number;
  dono_membro_id: string | null;
  status: "ativo" | "concluido" | "cancelado";
}

export type StatusItem = "orçando" | "contratado" | "quitado";

export interface ProjetoItem {
  id: string;
  casa_id: string;
  projeto_id: string;
  fornecedor: string | null;
  descricao: string;
  tipo_item: string | null;
  valor_orcado: number;
  valor_contratado: number;
  /** pago antes de usar o app: entra nos totais do projeto, mas não gera ocorrência */
  valor_pago_antes: number;
  contato: string | null;
  observacoes: string | null;
  status: StatusItem;
}

export interface Reserva {
  id: string;
  casa_id: string;
  nome: string;
  banco: string | null;
  dono_membro_id: string | null;
  observacao: string | null;
  ativa: boolean;
}

export interface ReservaSaldo {
  id: string;
  casa_id: string;
  reserva_id: string;
  data: string;
  valor: number;
}

export type RachaTipo = "mensalidade" | "diaria" | "amistoso" | "juiz" | "outro";

export interface RachaMovimento {
  id: string;
  casa_id: string;
  data: string;
  tipo: RachaTipo;
  sentido: Tipo;
  valor: number;
  descricao: string | null;
  transacao_importada_id: string | null;
}

/** Visão global: id de um membro ou "casal". */
export type Visao = string;
export const CASAL = "casal";
