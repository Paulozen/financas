"use client";

import { Layer, Rectangle, ResponsiveContainer, Sankey, Tooltip } from "recharts";
import type { NodeProps } from "recharts/types/chart/Sankey";
import { formatarReais } from "@/lib/dinheiro";
import { useCoresGrafico } from "@/lib/graficos";

export interface FluxoMapa {
  entradas: { nome: string; valor: number; cor: string }[];
  saidas: { nome: string; valor: number; cor: string }[];
}

/**
 * Mapa do dinheiro (ideia do "Money Map" do Securo): de onde veio (entradas por
 * categoria) e para onde foi (saídas por categoria e o que sobrou), com a largura das
 * faixas proporcional ao valor.
 */
export function MapaDinheiro({ entradas, saidas }: FluxoMapa) {
  const cores = useCoresGrafico();
  const totalE = entradas.reduce((s, x) => s + x.valor, 0);
  const totalS = saidas.reduce((s, x) => s + x.valor, 0);
  const origens = [...entradas];
  if (totalS > totalE) origens.push({ nome: "Do guardado / falta", valor: totalS - totalE, cor: "#94a3b8" });
  const destinos = [...saidas];
  if (totalE > totalS) destinos.push({ nome: "Sobrou", valor: totalE - totalS, cor: cores.positivo });
  const meio = origens.length;
  const nodes = [...origens.map((o) => ({ name: o.nome, cor: o.cor })), { name: "Mês", cor: "#64748b" }, ...destinos.map((d) => ({ name: d.nome, cor: d.cor }))];
  const links = [
    ...origens.map((o, i) => ({ source: i, target: meio, value: o.valor })),
    ...destinos.map((d, i) => ({ source: meio, target: meio + 1 + i, value: d.valor })),
  ].filter((l) => l.value > 0);
  const altura = Math.max(260, Math.max(origens.length, destinos.length) * 34);

  return (
    <div className="w-full" style={{ height: altura }} role="img" aria-label="Mapa do dinheiro: entradas por categoria e para onde foram">
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={{ nodes, links }}
          nodePadding={14}
          nodeWidth={8}
          margin={{ top: 8, right: 92, bottom: 8, left: 92 }}
          link={{ stroke: cores.grade, strokeOpacity: 0.9 }}
          node={(props: NodeProps) => {
            const { x, y, width, height, index } = props;
            const payload = props.payload as unknown as { name: string; cor: string };
            const esquerda = index < meio;
            const centro = index === meio;
            return (
              <Layer key={`n${index}`}>
                <Rectangle x={x} y={y} width={width} height={height} fill={payload.cor} radius={2} />
                {!centro && (
                  <text
                    x={esquerda ? x - 6 : x + width + 6}
                    y={y + height / 2}
                    textAnchor={esquerda ? "end" : "start"}
                    dominantBaseline="middle"
                    fontSize={11}
                    fill={cores.texto}
                  >
                    {payload.name.length > 13 ? payload.name.slice(0, 12) + "…" : payload.name}
                  </text>
                )}
              </Layer>
            );
          }}
        >
          <Tooltip
            formatter={(v) => formatarReais(Number(v))}
            contentStyle={{ background: cores.superficie, borderColor: cores.grade, borderRadius: 12, color: cores.texto, fontSize: 12 }}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}

/** Mini gráfico de linha (tendência de uma categoria). */
export function Faisca({ valores, cor }: { valores: number[]; cor: string }) {
  const max = Math.max(1, ...valores);
  const w = 64;
  const h = 22;
  const pts = valores.map((v, i) => `${(i / Math.max(1, valores.length - 1)) * w},${h - 2 - (v / max) * (h - 4)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
