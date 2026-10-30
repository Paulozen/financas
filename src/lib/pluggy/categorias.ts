// Categoria da Pluggy -> nome de categoria do app (sugestão; o usuário pode mudar).
import { semAcentos } from "../importacao/texto";

const MAPA: [RegExp, string[]][] = [
  [/groceries|supermarket/, ["Mercado"]],
  [/eating out|food delivery|food and drinks|restaurant|bakery/, ["Alimentação", "Mercado"]],
  [/taxi|ride-hailing|gas station|parking|automotive|vehicle|public transport|toll/, ["Transporte"]],
  [/pharmacy|health|hospital|dentist|wellness|gyms|fitness/, ["Saúde"]],
  [/electricity|water|telecommunications|internet|housing services|utilities/, ["Contas da casa"]],
  [/real estate financing|rent|housing|houseware/, ["Moradia"]],
  [/shopping|electronics|clothing|bookstore|online shopping|marketplace/, ["Compras", "Outros"]],
  [/digital services|streaming|entertainment|leisure|travel|tickets/, ["Lazer"]],
  [/salary|payroll/, ["Salário"]],
];

/**
 * Sugere a categoria do app para uma categoria da Pluggy. `tipo` filtra por
 * entrada/saída. Devolve o id ou null.
 */
export function categoriaDaPluggy(
  categoriaPluggy: string | null | undefined,
  tipo: "entrada" | "saida",
  categorias: { id: string; nome: string; tipo: string; ativa: boolean }[],
): string | null {
  if (!categoriaPluggy) return null;
  const c = semAcentos(categoriaPluggy);
  for (const [re, nomes] of MAPA) {
    if (!re.test(c)) continue;
    for (const nome of nomes) {
      const achada = categorias.find((k) => k.ativa && k.tipo === tipo && semAcentos(k.nome) === semAcentos(nome));
      if (achada) return achada.id;
    }
  }
  return null;
}
