import { COLORS, WeekRow } from "@/lib/forecast";

const W = 900, H = 220, padL = 46, padR = 10, padT = 10, padB = 24;
const plotW = W - padL - padR, plotH = H - padT - padB;

export default function NetChart({ weekly }: { weekly: WeekRow[] }) {
  const balances = weekly.map((w) => w.balance);
  const maxBal = Math.max(...balances, 0);
  const minBal = Math.min(...balances, 0);
  const range = maxBal - minBal || 1;
  const yFor = (v: number) => padT + plotH - ((v - minBal) / range) * plotH;
  const zeroY = yFor(0);
  const n = weekly.length || 1;
  const bw = plotW / n;

  const points = weekly.map((w, i) => `${(padL + i * bw + bw / 2).toFixed(1)},${yFor(w.balance).toFixed(1)}`).join(" ");
  const step = n > 14 ? 2 : 1;
  const yTicks = 4;

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {Array.from({ length: yTicks + 1 }, (_, t) => {
        const val = minBal + (range * t) / yTicks;
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
        const x = padL + i * bw + bw * 0.2;
        const barW = bw * 0.6;
        const y0 = yFor(0), y1 = yFor(w.net);
        const top = Math.min(y0, y1), h = Math.max(Math.abs(y1 - y0), 1);
        const color = w.net >= 0 ? COLORS.income : COLORS.expense;
        return <rect key={w.week} x={x} y={top} width={barW} height={h} fill={color} opacity={0.55} rx={3} />;
      })}
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke={COLORS.expense} strokeWidth={1} strokeDasharray="3 3" />
      <polyline
        points={points}
        fill="none"
        stroke={COLORS.ink}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {weekly.map((w, i) => (
        <circle key={w.week} cx={padL + i * bw + bw / 2} cy={yFor(w.balance)} r={2.5} fill={COLORS.ink} />
      ))}
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
