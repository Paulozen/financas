// Ícone e "essencial" das categorias. Quando o usuário não escolheu, decide pelo nome.
import {
  ArrowLeftRight,
  Baby,
  Banknote,
  Beer,
  Bike,
  Book,
  Briefcase,
  Building2,
  Bus,
  Car,
  Church,
  CircleEllipsis,
  Coffee,
  Coins,
  CreditCard,
  Dumbbell,
  FileText,
  Film,
  Fuel,
  Gamepad2,
  Gem,
  Gift,
  GraduationCap,
  HandCoins,
  HandHeart,
  Heart,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Luggage,
  Music,
  Package,
  PartyPopper,
  PawPrint,
  Percent,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Receipt,
  Repeat,
  Scissors,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Smartphone,
  Sofa,
  Sparkles,
  Stethoscope,
  TrainFront,
  TrendingUp,
  Trophy,
  Tv,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Categoria } from "./tipos";

export const ICONES: Record<string, LucideIcon> = {
  casa: House,
  sofa: Sofa,
  predio: Building2,
  ferramenta: Wrench,
  luz: Zap,
  internet: Wifi,
  celular: Smartphone,
  conta: Receipt,
  documento: FileText,
  mercado: ShoppingBasket,
  carrinho: ShoppingCart,
  restaurante: Utensils,
  cafe: Coffee,
  pizza: Pizza,
  bar: Beer,
  onibus: Bus,
  carro: Car,
  combustivel: Fuel,
  bicicleta: Bike,
  trem: TrainFront,
  saude: HeartPulse,
  remedio: Pill,
  medico: Stethoscope,
  academia: Dumbbell,
  jogos: Gamepad2,
  filme: Film,
  musica: Music,
  tv: Tv,
  festa: PartyPopper,
  educacao: GraduationCap,
  livro: Book,
  familia: Users,
  bebe: Baby,
  pet: PawPrint,
  presente: Gift,
  compras: ShoppingBag,
  roupa: Shirt,
  beleza: Scissors,
  brilho: Sparkles,
  joia: Gem,
  viagem: Plane,
  mala: Luggage,
  igreja: Church,
  doacao: HandHeart,
  coracao: Heart,
  cartao: CreditCard,
  banco: Landmark,
  divida: Percent,
  seguro: Shield,
  pacote: Package,
  trabalho: Briefcase,
  notebook: Laptop,
  salario: Banknote,
  dinheiro: Wallet,
  moedas: Coins,
  ajuda: HandCoins,
  investimento: TrendingUp,
  cofre: PiggyBank,
  trofeu: Trophy,
  recorrente: Repeat,
  transferencia: ArrowLeftRight,
  outros: CircleEllipsis,
};

// Palavras do nome -> ícone (a primeira que bater).
const PELO_NOME: [RegExp, string][] = [
  [/casamento|noiv|festa|evento/, "festa"],
  [/aluguel|moradia|condom|financiamento|apartamento|\bcasa\b|imovel|imóvel/, "casa"],
  [/mercado|supermerc|feira|hortifruti|padaria/, "mercado"],
  [/restaurante|ifood|delivery|lanche|comida|alimenta/, "restaurante"],
  [/cafe|café/, "cafe"],
  [/bar\b|bebida|cerveja/, "bar"],
  [/combust|gasolina|posto/, "combustivel"],
  [/uber|transporte|onibus|ônibus|metro|metrô/, "onibus"],
  [/carro|veiculo|veículo|ipva|estacion/, "carro"],
  [/farmacia|farmácia|remedio|remédio/, "remedio"],
  [/saude|saúde|medic|médic|plano de saude|hospital|dentista/, "saude"],
  [/academia|esporte|racha|futebol|treino/, "academia"],
  [/lazer|divers|entreten|passeio/, "jogos"],
  [/streaming|assinatura|netflix|spotify/, "tv"],
  [/educa|escola|faculdade|curso|estudo/, "educacao"],
  [/pens[aã]o|filh|crian|bebe|bebê/, "familia"],
  [/pet|cachorro|gato|veterin/, "pet"],
  [/presente|ajuda/, "presente"],
  [/roupa|vestu/, "roupa"],
  [/beleza|cabelo|salao|salão|estetica|estética/, "beleza"],
  [/compras|shopping|loja/, "compras"],
  [/viage|ferias|férias|hotel|passagem/, "viagem"],
  [/igreja|dizimo|dízimo|oferta/, "igreja"],
  [/doa[cç]/, "doacao"],
  [/luz|energia|agua|água|g[aá]s\b|contas da casa|internet|telefone/, "luz"],
  [/cart[aã]o|fatura/, "cartao"],
  [/d[ií]vida|empr[eé]stimo|juros/, "divida"],
  [/seguro/, "seguro"],
  [/reforma|obra|constru|manuten/, "ferramenta"],
  [/m[oó]veis|decora/, "sofa"],
  [/imposto|taxa|tarifa/, "documento"],
  [/sal[aá]rio|pagamento|holerite/, "salario"],
  [/rendimento|investimento|dividendo/, "investimento"],
  [/reserva|poupan|guardad/, "cofre"],
  [/freela|trabalho|servi[cç]o/, "trabalho"],
  [/receita|venda|reembolso/, "moedas"],
  [/transfer/, "transferencia"],
];

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

export function chaveIcone(c: Pick<Categoria, "nome" | "icone">): string {
  if (c.icone && ICONES[c.icone]) return c.icone;
  const n = c.nome.toLowerCase();
  const sem = normalizar(c.nome);
  for (const [re, chave] of PELO_NOME) if (re.test(n) || re.test(sem)) return chave;
  return "outros";
}

export function IconeCategoria({
  categoria,
  tamanho = "md",
  className,
}: {
  categoria: Pick<Categoria, "nome" | "icone" | "cor"> | null | undefined;
  tamanho?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icone = ICONES[categoria ? chaveIcone(categoria) : "outros"];
  const cor = categoria?.cor ?? "#94a3b8";
  const caixa = { sm: "size-8 rounded-xl", md: "size-10 rounded-[0.9rem]", lg: "size-14 rounded-[1.15rem]" }[tamanho];
  const icone = { sm: "size-4", md: "size-5", lg: "size-7" }[tamanho];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${caixa} ${className ?? ""}`}
      style={{ background: `color-mix(in srgb, ${cor} 15%, transparent)`, color: cor }}
      aria-hidden
    >
      <Icone className={icone} strokeWidth={2} />
    </span>
  );
}

// Gastos não essenciais pelo nome (quando o usuário não marcou).
const NAO_ESSENCIAL = /lazer|restaurante|ifood|delivery|lanche|bar\b|bebida|cafe|café|viage|ferias|férias|presente|compras|shopping|jogos|games|streaming|assinatura|divers|entreten|beleza|roupa|superfluo|supérfluo/;

export function ehEssencial(c: Pick<Categoria, "nome" | "essencial"> | null | undefined): boolean {
  if (!c) return true;
  if (c.essencial !== null && c.essencial !== undefined) return c.essencial;
  return !NAO_ESSENCIAL.test(c.nome.toLowerCase()) && !NAO_ESSENCIAL.test(normalizar(c.nome));
}
