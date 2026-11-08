// Motor de regras portado do Securo (backend/app/services/rule_engine.py), adaptado:
// condições sobre a descrição e o valor (entrada positiva, saída negativa), comparação
// sem acentos e sem diferença de maiúsculas, grupos E/OU em dois níveis, valor vazio
// nunca bate, regex que casa com texto vazio é rejeitada. Ações: categoria (a primeira
// regra que define a categoria vence), ignorar e trocar a descrição.

export type CampoRegra = "descricao" | "valor";
export type OpRegra = "contem" | "nao_contem" | "comeca_com" | "termina_com" | "igual" | "diferente" | "regex" | "maior" | "maior_igual" | "menor" | "menor_igual";

export interface Condicao {
  campo: CampoRegra;
  op: OpRegra;
  valor: string;
}
export interface GrupoCondicoes {
  operador: "and" | "or";
  condicoes: Condicao[];
}

export interface Regra {
  id: string;
  casa_id?: string;
  nome: string;
  operador: "and" | "or";
  condicoes: (Condicao | GrupoCondicoes)[];
  categoria_id: string | null;
  ignorar: boolean;
  nova_descricao: string | null;
  prioridade: number;
  ativa: boolean;
}

export interface Movimento {
  descricao: string;
  /** centavos; entrada positiva, saída negativa */
  valor: number;
}

export const ROTULO_OP: Record<OpRegra, string> = {
  contem: "contém",
  nao_contem: "não contém",
  comeca_com: "começa com",
  termina_com: "termina com",
  igual: "é igual a",
  diferente: "é diferente de",
  regex: "bate com a expressão",
  maior: "maior que",
  maior_igual: "maior ou igual a",
  menor: "menor que",
  menor_igual: "menor ou igual a",
};

export const OPS_TEXTO: OpRegra[] = ["contem", "nao_contem", "comeca_com", "termina_com", "igual", "diferente", "regex"];
export const OPS_VALOR: OpRegra[] = ["igual", "diferente", "maior", "maior_igual", "menor", "menor_igual"];

const semAcento = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "");
const normalizar = (s: string) => semAcento(s).toUpperCase();

/** Compila a regex como o Securo: sem acentos, sem diferenciar maiúsculas, e não pode casar com "". */
export function compilarRegex(padrao: string): RegExp {
  let re: RegExp;
  try {
    re = new RegExp(semAcento(padrao), "i");
  } catch {
    throw new Error("Expressão regular inválida");
  }
  if (re.test("")) throw new Error("A expressão não pode casar com um texto vazio");
  return re;
}

/** "12,50" / "-12,50" / "1.234,56" -> centavos. */
function lerValor(v: string): number | null {
  const t = v.trim().replace(/\s|R\$/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function bateCondicao(c: Condicao, m: Movimento): boolean {
  // Valor em branco não bate (senão uma regra antiga recategorizaria tudo).
  if (c.valor === undefined || c.valor === null || !String(c.valor).trim()) return false;
  if (c.campo === "valor") {
    const alvo = lerValor(c.valor);
    if (alvo === null) return false;
    switch (c.op) {
      case "igual":
        return m.valor === alvo;
      case "diferente":
        return m.valor !== alvo;
      case "maior":
        return m.valor > alvo;
      case "maior_igual":
        return m.valor >= alvo;
      case "menor":
        return m.valor < alvo;
      case "menor_igual":
        return m.valor <= alvo;
      default:
        return false;
    }
  }
  const texto = normalizar(m.descricao ?? "");
  const valor = normalizar(String(c.valor));
  switch (c.op) {
    case "contem":
      return texto.includes(valor);
    case "nao_contem":
      return !texto.includes(valor);
    case "comeca_com":
      return texto.startsWith(valor);
    case "termina_com":
      return texto.endsWith(valor);
    case "igual":
      return texto === valor;
    case "diferente":
      return texto !== valor;
    case "regex":
      try {
        return compilarRegex(String(c.valor)).test(texto);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

const ehGrupo = (n: Condicao | GrupoCondicoes): n is GrupoCondicoes => Array.isArray((n as GrupoCondicoes).condicoes);

export function bateRegra(r: Pick<Regra, "operador" | "condicoes">, m: Movimento): boolean {
  if (!r.condicoes?.length) return false;
  const resultados = r.condicoes.map((n) => {
    if (!ehGrupo(n)) return bateCondicao(n, m);
    if (!n.condicoes.length) return false;
    const rs = n.condicoes.map((c) => bateCondicao(c, m));
    return n.operador === "or" ? rs.some(Boolean) : rs.every(Boolean);
  });
  return r.operador === "or" ? resultados.some(Boolean) : resultados.every(Boolean);
}

export interface ResultadoRegras {
  categoria_id: string | null;
  ignorar: boolean;
  descricao: string | null;
  /** nomes das regras que bateram, na ordem */
  regras: string[];
}

/**
 * Aplica as regras ativas por prioridade (menor primeiro). A categoria é definida uma
 * vez só (a primeira regra que a define vence); ignorar e nova descrição valem de
 * qualquer regra que bata (a nova descrição também é a primeira que aparece).
 * `categoriasValidas`: só essas podem ser escolhidas (as desativadas ou apagadas não).
 */
export function aplicarRegras(regras: Regra[], m: Movimento, categoriasValidas?: Set<string>): ResultadoRegras | null {
  const ordenadas = regras.filter((r) => r.ativa).sort((a, b) => a.prioridade - b.prioridade);
  const res: ResultadoRegras = { categoria_id: null, ignorar: false, descricao: null, regras: [] };
  for (const r of ordenadas) {
    if (!bateRegra(r, m)) continue;
    res.regras.push(r.nome);
    if (!res.categoria_id && r.categoria_id && (!categoriasValidas || categoriasValidas.has(r.categoria_id))) res.categoria_id = r.categoria_id;
    if (r.ignorar) res.ignorar = true;
    if (!res.descricao && r.nova_descricao?.trim()) res.descricao = r.nova_descricao.trim();
  }
  return res.regras.length ? res : null;
}

/** Valida antes de salvar (mesmas recusas do Securo). Devolve a mensagem de erro ou null. */
export function validarRegra(r: Pick<Regra, "nome" | "condicoes" | "categoria_id" | "ignorar" | "nova_descricao">): string | null {
  if (!r.nome.trim()) return "Dê um nome para a regra.";
  const folhas = r.condicoes.flatMap((n) => (ehGrupo(n) ? n.condicoes : [n]));
  if (!folhas.length) return "Adicione pelo menos uma condição.";
  for (const c of folhas) {
    if (!String(c.valor ?? "").trim()) return "Preencha o valor de todas as condições.";
    if (c.campo === "valor" && lerValor(c.valor) === null) return `"${c.valor}" não é um valor em reais.`;
    if (c.op === "regex") {
      try {
        compilarRegex(c.valor);
      } catch (e) {
        return (e as Error).message;
      }
    }
  }
  if (!r.categoria_id && !r.ignorar && !r.nova_descricao?.trim()) return "Escolha o que a regra faz (categoria, ignorar ou nova descrição).";
  return null;
}
