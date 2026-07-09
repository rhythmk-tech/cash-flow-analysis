import { COLORS, WeekRow } from "@/lib/forecast";

const W = 900, H = 220, padL = 46, padR = 10, padT = 10, padB = 24;
const plotW = W - padL - padR, plotH = H - padT - padB;

export default function FlowChart({ weekly }: { weekly: WeekRow[] }) {
  const maxVal = Math.max(...weekly.map((w) => Math.max(w.income, w.expense)), 1);
  const yFor = (v: number) => padT + plotH - (v / maxVal) * plotH;
  const n = weekly.length || 1;
  const bw = plotW / n;
  const step = n > 14 ? 2 : 1;
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
        return (
          <g key={w.week}>
            <rect x={xIn} y={yIn} width={barW} height={padT + plotH - yIn} fill={COLORS.income} rx={2} />
            <rect x={xOut} y={yOut} width={barW} height={padT + plotH - yOut} fill={COLORS.expense} rx={2} />
          </g>
        );
      })}
      {weekly.map((w, i) =>
        i % step === 0 ? (
          <text key={w.week} x={padL + i * bw + bw / 2} y={H - 6} fontSize={10} fill={COLORS.inkMuted} textAnchor="middle">
            W{w.week}
          </text>
        ) : null
      )}
    </svg>
  );
}
