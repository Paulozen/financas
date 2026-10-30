// Estado das conexões com os bancos (funções puras).
import { difDias } from "../datas";

export interface EstadoItem {
  pluggy_item_id: string;
  dono_membro_id: string | null;
  banco: string | null;
  status: string | null;
  erro_codigo: string | null;
  erro_mensagem?: string | null;
  consent_expires_at: string | null;
  ultima_sincronizacao: string | null;
  ultimo_erro: string | null;
}

const STATUS: Record<string, string> = {
  UPDATED: "Em dia",
  UPDATING: "Atualizando no banco",
  OUTDATED: "Desatualizado (o banco não respondeu na última atualização da Pluggy)",
  LOGIN_ERROR: "Erro de login no banco",
  WAITING_USER_INPUT: "Aguardando uma ação sua no Meu Pluggy",
  WAITING_USER_ACTION: "Aguardando uma ação sua no Meu Pluggy",
};

const ERROS: Record<string, string> = {
  USER_AUTHORIZATION_EXPIRED: "A autorização de leitura expirou",
  USER_AUTHORIZATION_REVOKED: "A autorização de leitura foi revogada",
  INVALID_CREDENTIALS: "Credenciais do banco inválidas no Meu Pluggy",
  ALREADY_LOGGED_IN: "O banco recusou o acesso porque já havia uma sessão aberta",
  SITE_NOT_AVAILABLE: "O site do banco estava fora do ar",
  CONNECTION_ERROR: "Falha de conexão com o banco",
};

export const COMO_RENOVAR =
  "Para renovar: no dashboard.pluggy.ai, abra Applications → sua aplicação → Demo → Connect Account → MeuPluggy e entre na sua conta do Meu Pluggy. " +
  "Depois de renovar o itemId pode mudar: confira em Connected Items e, se mudou, atualize PLUGGY_ITEMS_<NOME> no .env.local e nas variáveis da Vercel.";

/** Texto em português do estado de um item. */
export function descreverEstado(i: EstadoItem): string {
  if (i.erro_codigo) return ERROS[i.erro_codigo] ?? `Erro no banco (${i.erro_codigo})`;
  if (i.ultimo_erro) {
    if (/not found|404|não encontrado/i.test(i.ultimo_erro)) return "Item não encontrado na Pluggy (o itemId mudou? atualize o .env e a Vercel)";
    return `Falha na última sincronização: ${i.ultimo_erro}`;
  }
  return (i.status && STATUS[i.status]) ?? (i.status ? `Situação: ${i.status}` : "Ainda não sincronizado");
}

export interface AvisoConexao {
  pluggy_item_id: string;
  dono_membro_id: string | null;
  banco: string | null;
  tipo: "expirando" | "expirado" | "erro";
  texto: string;
}

/** Avisos para o Painel: autorização expirando em menos de 30 dias, expirada ou item com erro. */
export function avisosConexao(itens: EstadoItem[], hoje: string): AvisoConexao[] {
  const avisos: AvisoConexao[] = [];
  for (const i of itens) {
    const base = { pluggy_item_id: i.pluggy_item_id, dono_membro_id: i.dono_membro_id, banco: i.banco };
    const dias = i.consent_expires_at ? difDias(hoje, i.consent_expires_at.slice(0, 10)) : null;
    if (i.erro_codigo === "USER_AUTHORIZATION_EXPIRED" || (dias !== null && dias < 0)) {
      avisos.push({ ...base, tipo: "expirado", texto: "A autorização de leitura deste banco expirou." });
    } else if (i.erro_codigo || i.ultimo_erro || i.status === "LOGIN_ERROR") {
      avisos.push({ ...base, tipo: "erro", texto: descreverEstado(i) });
    } else if (dias !== null && dias < 30) {
      avisos.push({ ...base, tipo: "expirando", texto: `A autorização de leitura vence em ${dias} ${dias === 1 ? "dia" : "dias"}.` });
    }
  }
  return avisos;
}
