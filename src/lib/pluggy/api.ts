// Cliente da API Pluggy. SÓ NO SERVIDOR: usa PLUGGY_CLIENT_ID/SECRET.
import type { PluggyConta, PluggyFatura, PluggyInvestimento, PluggyItem, PluggyTransacao } from "./tipos";

const API = "https://api.pluggy.ai";

export class ErroPluggy extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export async function conectarPluggy() {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new ErroPluggy(500, "SEM_CREDENCIAIS", "PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET não estão configuradas no servidor.");
  const r = await fetch(`${API}/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
    cache: "no-store",
  });
  if (!r.ok) throw new ErroPluggy(r.status, "AUTH", "Não foi possível autenticar na Pluggy (confira as credenciais).");
  const { apiKey } = (await r.json()) as { apiKey: string };

  async function get<T>(caminho: string): Promise<T> {
    const res = await fetch(API + caminho, { headers: { "X-API-KEY": apiKey }, cache: "no-store" });
    const corpo = await res.json().catch(() => null);
    if (!res.ok) throw new ErroPluggy(res.status, corpo?.code ?? String(res.status), corpo?.message ?? `Erro ${res.status} na Pluggy`);
    return corpo as T;
  }

  return {
    item: (id: string) => get<PluggyItem>(`/items/${id}`),
    contas: async (itemId: string) => (await get<{ results: PluggyConta[] }>(`/accounts?itemId=${itemId}`)).results,
    /** Transações v2 desde `desde` (aaaa-mm-dd), seguindo a paginação por cursor. */
    transacoes: async (accountId: string, desde: string) => {
      const lista: PluggyTransacao[] = [];
      let q: string | null = `?accountId=${accountId}&dateFrom=${desde}`;
      for (let paginas = 0; q && paginas < 40; paginas++) {
        const r: { results: PluggyTransacao[]; next: string | null } = await get(`/v2/transactions${q}`);
        lista.push(...r.results);
        q = r.next;
      }
      return lista;
    },
    faturas: async (accountId: string) => (await get<{ results: PluggyFatura[] }>(`/bills?accountId=${accountId}`)).results,
    investimentos: async (itemId: string) => (await get<{ results: PluggyInvestimento[] }>(`/investments?itemId=${itemId}`)).results,
  };
}

export type ClientePluggy = Awaited<ReturnType<typeof conectarPluggy>>;
