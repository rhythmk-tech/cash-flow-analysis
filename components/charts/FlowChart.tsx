"use client";

import { useState } from "react";
import { COLORS, WeekRow, axisLabelStep, money, weekDateRange } from "@/lib/forecast";
import { ChartTooltip } from "./ChartTooltip";

const W = 900, H = 220, padL = 46, padR = 10, padT = 10, padB = 24;
const plotW = W - padL - padR, plotH = H - padT - padB;

export default function FlowChart({ weekly, forecastStart }: { weekly: WeekRow[]; forecastStart: Date }) {
  const [active, setActive] = useState<number | null>(null);
  const maxVal = Math.max(...weekly.map((w) => Math.max(w.income, w.expense)), 1);
  const yFor = (v: number) => padT + plotH - (v / maxVal) * plotH;
  const n = weekly.length || 1;
  const bw = plotW / n;
  const step = axisLabelStep(bw);
  const yTicks = 4;

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {Array.from({ length: yTicks + 1 }, (_, t) => {
        const val = (maxVal * t) / yTicks;
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
      {weekly.map((w, i) => {
        const groupX = padL + i * bw;
        const barW = bw * 0.32;
        const gap = bw * 0.06;
        const xIn = groupX + bw * 0.15;
        const xOut = xIn + barW + gap;
        const yIn = yFor(w.income), yOut = yFor(w.expense);
        const isActive = active === i;
        return (
          <g key={w.week} opacity={isActive ? 1 : 0.9}>
            <rect x={xIn} y={yIn} width={barW} height={padT + plotH - yIn} fill={COLORS.income} rx={2} />
            <rect x={xOut} y={yOut} width={barW} height={padT + plotH - yOut} fill={COLORS.expense} rx={2} />
          </g>
        );
      })}
      {weekly.map((w, i) =>
        i % step === 0 ? (
          <text key={w.week} x={padL + i * bw + bw / 2} y={H - 6} fontSize={10} fill={COLORS.inkMuted} textAnchor="middle">
            {weekDateRange(w.week, forecastStart)}
          </text>
        ) : null
      )}
      {weekly.map((w, i) => (
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
          x={padL + active * bw + bw / 2}
          y={yFor(Math.max(weekly[active].income, weekly[active].expense))}
          lines={[
            weekDateRange(weekly[active].week, forecastStart),
            `Inflows: ${money(weekly[active].income)}`,
            `Outflows: ${money(weekly[active].expense)}`,
          ]}
          viewW={W}
          viewH={H}
        />
      )}
    </svg>
  );
}
