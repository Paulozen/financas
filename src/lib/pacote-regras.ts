// Pacote de regras prontas para lojas e serviços comuns no Brasil (ideia dos "rule packs"
// do Securo; a lista é nossa). Vale depois das regras aprendidas do casal e antes da
// categoria genérica da Pluggy. Cada padrão aponta para nomes de categoria possíveis,
// na ordem de preferência; usa a primeira que existir (ativa) na casa.
import { semAcentos } from "./importacao/texto";

const PACOTE: [RegExp, string[]][] = [
  [/\b(ifood|ifd\*|rappi|ze delivery|aiqfome|99food|keeta)\b/, ["Alimentação", "Restaurante", "Lazer"]],
  [/\b(mcdonald|mc donald|burger king|bk brasil|subway|habib|giraffas|outback|starbucks|cacau show|kopenhagen|spoleto|pizza|pizzaria|lanchonete|restaurante|padaria|panificadora|sorveteria|acai)\b/, ["Alimentação", "Restaurante", "Lazer"]],
  [/\b(carrefour|assai|atacadao|pao de acucar|extra hiper|big bompreco|bompreco|mateus|atacarejo|supermercado|mercadinho|hortifruti|sams club|makro|frangolandia|mercantil)\b/, ["Mercado", "Alimentação"]],
  [/\b(uber(?! eats)|99app|99 tecnologia|99pop|cabify|indriver|buser|metro|bilhete unico|sem parar|conectcar|veloe|estapar|zona azul)\b/, ["Transporte"]],
  [/\b(posto|shell|ipiranga|petrobras|br mania|ale combustiveis|combustivel)\b/, ["Transporte", "Carro"]],
  [/\b(drogasil|droga raia|raia|pague menos|drogaria|farmacia|panvel|pacheco|extrafarma|sao joao farm)\b/, ["Saúde", "Farmácia"]],
  [/\b(smart fit|smartfit|bluefit|selfit|academia|gympass|wellhub|totalpass|unimed|hapvida|amil|sulamerica|bradesco saude|laboratorio|clinica|odonto)\b/, ["Saúde"]],
  [/\b(netflix|spotify|disney|hbo|max\.com|globoplay|prime video|amazon prime|youtube premium|deezer|apple\.com|google one|paramount|crunchyroll|playstation|xbox|steam|nintendo)\b/, ["Assinaturas", "Lazer"]],
  [/\b(cinema|cinemark|cinepolis|ingresso|sympla|eventim|ticketmaster|teatro|show)\b/, ["Lazer"]],
  [/\b(enel|coelce|cemig|light s\.?a|copel|celpe|coelba|energisa|equatorial|neoenergia|cagece|sabesp|compesa|embasa|copasa|cedae|comgas|claro|vivo|tim |oi fibra|net servicos|brisanet|internet)\b/, ["Contas da casa", "Moradia"]],
  [/\b(amazon|mercado ?livre|mercadolivre|magalu|magazine luiza|americanas|shopee|aliexpress|shein|casas bahia|kabum|netshoes|renner|riachuelo|c&a|cea |zara|centauro|decathlon|leroy merlin|tok stok|ikea)\b/, ["Compras", "Outros"]],
  [/\b(airbnb|booking|decolar|latam|gol linhas|azul linhas|voeazul|smiles|hotel|pousada|123milhas|maxmilhas)\b/, ["Viagem", "Lazer"]],
  [/\b(petz|cobasi|petlove|pet shop|petshop|veterinari)\b/, ["Pet", "Outros"]],
  [/\b(udemy|alura|coursera|duolingo|escola|faculdade|colegio|livraria|saraiva|curso)\b/, ["Educação", "Outros"]],
  [/\b(salao|barbearia|barber|cabeleireiro|estetica|manicure|boticario|natura|sephora|o boticario)\b/, ["Beleza", "Compras", "Outros"]],
  [/\b(iof|anuidade|tarifa|juros|encargos|multa)\b/, ["Tarifas", "Dívidas", "Outros"]],
];

type Cat = { id: string; nome: string; tipo: string; ativa: boolean };

/** Categoria (id) sugerida pelo pacote para a descrição de uma saída, ou null. */
export function categoriaDoPacote(descricao: string, categorias: Cat[]): string | null {
  const d = ` ${semAcentos(descricao)} `;
  for (const [re, nomes] of PACOTE) {
    if (!re.test(d)) continue;
    for (const nome of nomes) {
      const achada = categorias.find((c) => c.ativa && c.tipo === "saida" && semAcentos(c.nome) === semAcentos(nome));
      if (achada) return achada.id;
    }
  }
  return null;
}
