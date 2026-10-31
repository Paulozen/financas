// Grupos de investimentos ("reservas automáticas"). Funções puras.
// O Open Finance não identifica cada caixinha (todas as aplicações vêm iguais,
// só mudam datas e valores), então o grupo é dono + banco + tipo do investimento.

export interface InvestimentoGrupo {
  id: string;
  pluggy_item_id: string;
  tipo: string | null;
  subtipo: string | null;
  nome?: string;
  saldo: number;
  status: string | null;
  vencimento: string | null;
  reserva_id: string | null;
}

/** Entra no total? Aplicações resgatadas, zeradas ou vencidas ficam de fora. */
export function contaNoTotal(i: Pick<InvestimentoGrupo, "status" | "saldo" | "vencimento">, hoje: string): boolean {
  return i.status !== "TOTAL_WITHDRAWAL" && Number(i.saldo) > 0 && (!i.vencimento || i.vencimento >= hoje);
}

/** Chave do grupo: mesmo item (banco + dono) e mesmo tipo de investimento. */
export function chaveGrupo(i: Pick<InvestimentoGrupo, "pluggy_item_id" | "tipo" | "subtipo">): string {
  return [i.pluggy_item_id, i.tipo ?? "", i.subtipo ?? ""].join("|");
}

const TIPOS: [RegExp, string][] = [
  [/^STOCK$/, "Ações"],
  [/^(ETF)$/, "ETFs"],
  [/REAL_ESTATE_FUND|FII/, "Fundos imobiliários"],
  [/FUND/, "Fundos"],
  [/TREASURY|TESOURO/, "Tesouro Direto"],
  [/^(LCI|LCA)$/, "LCI/LCA"],
  [/^CDB$/, "CDBs"],
];

/** Nome do grupo: "Caixinhas PicPay (Laura)", "Ações Banco Inter (Paulo)"... */
export function nomeGrupo(tipo: string | null, subtipo: string | null, banco: string | null, dono: string | null): string {
  const b = (banco ?? "").trim();
  const ehPicPay = /picpay/i.test(b);
  let base: string;
  if (ehPicPay && subtipo === "CDB") base = "Caixinhas PicPay";
  else {
    const t = TIPOS.find(([re]) => re.test(subtipo ?? "") || re.test(tipo ?? ""))?.[1] ?? (tipo === "EQUITY" ? "Renda variável" : "Investimentos");
    base = b ? `${t} ${ehPicPay ? "PicPay" : b}` : t;
  }
  return dono ? `${base} (${dono})` : base;
}

/** Saldo de cada reserva = soma das aplicações vinculadas que entram no total. */
export function saldoPorReserva(investimentos: InvestimentoGrupo[], hoje: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of investimentos) {
    if (!i.reserva_id) continue;
    m.set(i.reserva_id, (m.get(i.reserva_id) ?? 0) + (contaNoTotal(i, hoje) ? Number(i.saldo) : 0));
  }
  return m;
}
