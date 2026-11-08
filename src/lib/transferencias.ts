// Pares de transferência entre contas de vocês, portado do Securo
// (transfer_detection_service.py + reconciliation_policy.MATCH_TRANSFER + text_similarity.py):
// - saída numa conta e entrada de mesmo valor exato em OUTRA conta, até 2 dias de distância;
// - desempate pela data mais próxima e, depois, pela descrição que cita a outra conta;
// - só vira par quando cada lado é a melhor resposta única do outro ("os dois concordam");
//   se houver empate, fica como sugestão (ambígua) e ninguém é ligado sozinho.
// Compras no cartão nunca são transferência (aqui só entram contas correntes).
import { difDias } from "./datas";

export interface MovConta {
  id: string;
  conta_id: string;
  data: string;
  /** centavos; entrada positiva, saída negativa */
  valor: number;
  descricao: string;
}

const GENERICAS = new Set([
  "account", "balance", "bank", "banco", "card", "cartao", "cash", "checking", "conta", "corrente", "credit", "credito",
  "current", "debit", "debito", "deposit", "deposito", "dinheiro", "investimento", "investment", "main", "money", "poupanca",
  "principal", "salario", "salary", "savings", "transfer", "transferencia", "wallet", "carteira", "pagamento", "pagamentos",
  "instituicao", "sa", "ltda",
]);

export function palavras(v: string | null | undefined): string[] {
  if (!v) return [];
  return v
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^0-9a-z]+/)
    .filter(Boolean);
}

/** O texto cita a conta? Palavras genéricas não contam; palavra inteira ou começo de palavra (4+ letras). */
export function citaConta(texto: string | null | undefined, nomeConta: string | null | undefined): boolean {
  const procuradas = palavras(nomeConta).filter((p) => !GENERICAS.has(p) && p.length >= 3 && !/^\d+$/.test(p));
  if (!procuradas.length) return false;
  const impressas = palavras(texto);
  if (!impressas.length) return false;
  const exatas = new Set(impressas);
  return procuradas.some((p) => exatas.has(p) || (p.length >= 4 && impressas.some((t) => t.startsWith(p))));
}

export interface ResultadoTransferencias {
  /** id -> id do outro lado (os dois concordam) */
  pares: Map<string, string>;
  /** ids com candidato, mas sem par único */
  ambiguos: Set<string>;
}

export function paresDeTransferencia(movs: MovConta[], nomeConta: (id: string) => string = () => "", janelaDias = 2): ResultadoTransferencias {
  const candidatos = (m: MovConta) =>
    movs
      .filter((o) => o.conta_id !== m.conta_id && o.valor === -m.valor && Math.sign(o.valor) !== Math.sign(m.valor) && Math.abs(difDias(m.data, o.data)) <= janelaDias)
      .map((o) => ({
        o,
        dias: Math.abs(difDias(m.data, o.data)),
        // A descrição de um lado citar a conta do outro (ou a própria) é o desempate.
        cita: citaConta(m.descricao, nomeConta(o.conta_id)) || citaConta(o.descricao, nomeConta(m.conta_id)) ? 0 : 1,
      }))
      .sort((a, b) => a.dias - b.dias || a.cita - b.cita);

  // Melhor resposta única de cada movimento (null se empatar).
  const melhor = new Map<string, string | null>();
  const temCandidato = new Set<string>();
  for (const m of movs) {
    if (m.valor === 0) continue;
    const c = candidatos(m);
    if (!c.length) continue;
    temCandidato.add(m.id);
    const unico = c.length === 1 || c[0].dias !== c[1].dias || c[0].cita !== c[1].cita;
    melhor.set(m.id, unico ? c[0].o.id : null);
  }
  const pares = new Map<string, string>();
  for (const [id, outro] of melhor) {
    if (outro && melhor.get(outro) === id) pares.set(id, outro);
  }
  const ambiguos = new Set([...temCandidato].filter((id) => !pares.has(id)));
  return { pares, ambiguos };
}
