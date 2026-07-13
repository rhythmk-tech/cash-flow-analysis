"use client";

import { useState } from "react";
import { COLORS, ScenarioPoint, money } from "@/lib/forecast";
import { ChartTooltip } from "./ChartTooltip";

const W = 900, H = 220, padL = 46, padR = 10, padT = 10, padB = 24;
const plotW = W - padL - padR, plotH = H - padT - padB;

export default function ScenarioChart({
  bear,
  base,
  bull,
}: {
  bear: ScenarioPoint[];
  base: ScenarioPoint[];
  bull: ScenarioPoint[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const allVals = [...bear, ...base, ...bull].map((w) => w.balance);
  const maxV = Math.max(...allVals, 0);
  const minV = Math.min(...allVals, 0);
  const range = maxV - minV || 1;
  const yFor = (v: number) => padT + plotH - ((v - minV) / range) * plotH;
  const n = base.length || 1;
  const bw = plotW / n;
  const xFor = (i: number) => padL + i * bw + bw / 2;
  const toPoints = (arr: ScenarioPoint[]) => arr.map((w, i) => `${xFor(i).toFixed(1)},${yFor(w.balance).toFixed(1)}`).join(" ");
  const step = n > 14 ? 2 : 1;
  const yTicks = 4;
  const zeroY = yFor(0);

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {Array.from({ length: yTicks + 1 }, (_, t) => {
        const val = minV + (range * t) / yTicks;
        const y = yFor(val);
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={COLORS.border} strokeWidth={1} />
            <text x={padL - 6} y={y + 3} fontSize={10} fill={COLORS.inkMuted} textAnchor="end">
              ${Math.round(val / 1000)}k
            </text>
          </g>
        );
      })}
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke={COLORS.expense} strokeWidth={1} strokeDasharray="3 3" />
      <polyline
        points={toPoints(bear)}
        fill="none"
        stroke={COLORS.expense}
        strokeWidth={2}
        strokeDasharray="6 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={toPoints(base)}
        fill="none"
        stroke={COLORS.ink}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={toPoints(bull)}
        fill="none"
        stroke={COLORS.income}
        strokeWidth={2}
        strokeDasharray="1 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {active !== null && (
        <>
          <circle cx={xFor(active)} cy={yFor(bear[active].balance)} r={4} fill={COLORS.expense} stroke="white" strokeWidth={1.5} />
          <circle cx={xFor(active)} cy={yFor(base[active].balance)} r={4} fill={COLORS.ink} stroke="white" strokeWidth={1.5} />
          <circle cx={xFor(active)} cy={yFor(bull[active].balance)} r={4} fill={COLORS.income} stroke="white" strokeWidth={1.5} />
        </>
      )}
      {base.map((w, i) =>
        i % step === 0 ? (
          <text key={w.week} x={xFor(i)} y={H - 6} fontSize={10} fill={COLORS.inkMuted} textAnchor="middle">
            W{w.week}
          </text>
        ) : null
      )}
      {base.map((w, i) => (
        <rect
          key={`hit-${w.week}`}
          x={padL + i * bw}
          y={padT}
          width={bw}
          height={plotH}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setActive(i)}
          onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
          onClick={() => setActive((cur) => (cur === i ? null : i))}
        />
      ))}
      {active !== null && (
        <ChartTooltip
          x={xFor(active)}
          y={yFor(base[active].balance)}
          lines={[
            `Week ${base[active].week}`,
            `Bear: ${money(bear[active].balance)}`,
            `Base: ${money(base[active].balance)}`,
            `Bull: ${money(bull[active].balance)}`,
          ]}
          viewW={W}
          viewH={H}
        />
      )}
    </svg>
  );
}
