"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { nomeMesCurto } from "@/lib/datas";
import { formatarReais } from "@/lib/dinheiro";
import { reaisCurto, useCoresGrafico } from "@/lib/graficos";
import { useOcultar } from "@/lib/ocultar";

/** Rosca de gastos por categoria, com o total no meio. Fatias separadas por 2px da superfície. */
export function Rosca({
  fatias,
  total,
  rotulo,
  selecionada,
  aoSelecionar,
}: {
  fatias: { id: string; nome: string; valor: number; cor: string }[];
  total: number;
  rotulo: string;
  selecionada?: string | null;
  aoSelecionar?: (id: string | null) => void;
}) {
  const cores = useCoresGrafico();
  const ocultar = useOcultar();
  const sel = fatias.find((f) => f.id === selecionada);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-64" role="img" aria-label={`Rosca: ${rotulo}`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={fatias}
            dataKey="valor"
            nameKey="nome"
            innerRadius="68%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke={cores.superficie}
            strokeWidth={2}
            isAnimationActive={false}
            onClick={(_, i) => aoSelecionar?.(fatias[i]?.id === selecionada ? null : (fatias[i]?.id ?? null))}
          >
            {fatias.map((f) => (
              <Cell key={f.id} fill={f.cor} opacity={selecionada && selecionada !== f.id ? 0.35 : 1} className="cursor-pointer outline-none" />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
        <span className="valor-oculto numero-grande text-xl font-bold sm:text-2xl">{formatarReais(sel?.valor ?? total)}</span>
        <span className="max-w-full truncate text-xs text-slate-500">{sel ? `${sel.nome} · ${Math.round((sel.valor / total) * 100)}%` : rotulo}</span>
        {ocultar && <span className="sr-only">valores escondidos</span>}
      </div>
    </div>
  );
}

/** Acumulado do mês (linha cheia) contra o mês anterior (tracejada). */
export function CurvaRitmo({
  atual,
  anterior,
  nomeAtual,
  nomeAnterior,
  cor,
}: {
  atual: number[];
  anterior: number[];
  nomeAtual: string;
  nomeAnterior: string;
  cor: string;
}) {
  const cores = useCoresGrafico();
  const n = Math.max(atual.length, anterior.length, 28);
  const dados = Array.from({ length: n }, (_, i) => ({ dia: i + 1, atual: atual[i] ?? null, anterior: anterior[i] ?? null }));
  return (
    <div className="h-48 w-full" role="img" aria-label={`Gasto acumulado de ${nomeAtual} comparado com ${nomeAnterior}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="ritmo-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.22} />
              <stop offset="100%" stopColor={cor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={cores.grade} vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="dia" tick={{ fill: cores.textoSecundario, fontSize: 11 }} stroke={cores.grade} interval="preserveStartEnd" minTickGap={14} tickLine={false} />
          <YAxis tickFormatter={reaisCurto} tick={{ fill: cores.textoSecundario, fontSize: 11 }} stroke="transparent" width={52} />
          <Tooltip
            labelFormatter={(d) => `Dia ${d}`}
            formatter={(v, nome) => [formatarReais(Number(v)), nome === "atual" ? nomeAtual : nomeAnterior]}
            contentStyle={{ background: cores.superficie, borderColor: cores.grade, borderRadius: 12, color: cores.texto, fontSize: 12 }}
          />
          <Area type="monotone" dataKey="anterior" stroke={cores.textoSecundario} strokeDasharray="4 4" strokeWidth={2} fill="transparent" dot={false} connectNulls={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="atual" stroke={cor} strokeWidth={2.5} fill="url(#ritmo-area)" dot={false} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Gasto por dia do mês, com a média como linha de referência. */
export function BarrasDiarias({ valores, media, cor }: { valores: number[]; media: number; cor: string }) {
  const cores = useCoresGrafico();
  const dados = valores.map((v, i) => ({ dia: i + 1, valor: v }));
  return (
    <div className="h-48 w-full" role="img" aria-label="Gasto por dia do mês">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={cores.grade} vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="dia" tick={{ fill: cores.textoSecundario, fontSize: 11 }} stroke={cores.grade} interval="preserveStartEnd" minTickGap={14} tickLine={false} />
          <YAxis tickFormatter={reaisCurto} tick={{ fill: cores.textoSecundario, fontSize: 11 }} stroke="transparent" width={52} />
          <Tooltip
            labelFormatter={(d) => `Dia ${d}`}
            formatter={(v) => [formatarReais(Number(v)), "Gasto"]}
            contentStyle={{ background: cores.superficie, borderColor: cores.grade, borderRadius: 12, color: cores.texto, fontSize: 12 }}
            cursor={{ fill: cores.grade, opacity: 0.4 }}
          />
          {media > 0 && <ReferenceLine y={media} stroke={cores.textoSecundario} strokeDasharray="4 4" />}
          <Bar dataKey="valor" fill={cor} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Entradas e saídas mês a mês (barras lado a lado). */
export function MesAMes({ dados }: { dados: { mes: string; entradas: number; saidas: number }[] }) {
  const cores = useCoresGrafico();
  const linhas = dados.map((d, i) => ({ ...d, rotulo: i === 0 || d.mes.endsWith("-01") ? nomeMesCurto(d.mes) : nomeMesCurto(d.mes).slice(0, 3) }));
  return (
    <div className="h-56 w-full" role="img" aria-label="Entradas e saídas mês a mês">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={linhas} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid stroke={cores.grade} vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="rotulo" tick={{ fill: cores.textoSecundario, fontSize: 11 }} stroke={cores.grade} interval="preserveStartEnd" minTickGap={6} tickLine={false} />
          <YAxis tickFormatter={reaisCurto} tick={{ fill: cores.textoSecundario, fontSize: 11 }} stroke="transparent" width={52} />
          <Tooltip
            formatter={(v, nome) => [formatarReais(Number(v)), nome === "entradas" ? "Entradas" : "Saídas"]}
            contentStyle={{ background: cores.superficie, borderColor: cores.grade, borderRadius: 12, color: cores.texto, fontSize: 12 }}
            cursor={{ fill: cores.grade, opacity: 0.4 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(v) => <span style={{ color: cores.textoSecundario }}>{v === "entradas" ? "Entradas" : "Saídas"}</span>}
          />
          <Bar dataKey="entradas" fill={cores.positivo} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
          <Bar dataKey="saidas" fill={cores.negativo} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

