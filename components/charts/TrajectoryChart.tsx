import { COLORS, WeekRow } from "@/lib/forecast";

const W = 900, H = 220, padL = 46, padR = 10, padT = 10, padB = 24;
const plotW = W - padL - padR, plotH = H - padT - padB;

export default function TrajectoryChart({ weekly }: { weekly: WeekRow[] }) {
  const balances = weekly.map((w) => w.balance);
  const maxBal = Math.max(...balances, 0);
  const minBal = Math.min(...balances, 0);
  const range = maxBal - minBal || 1;
  const yFor = (v: number) => padT + plotH - ((v - minBal) / range) * plotH;
  const n = weekly.length || 1;
  const bw = plotW / n;
  const xFor = (i: number) => padL + i * bw + bw / 2;

  const points = weekly.map((w, i) => `${xFor(i).toFixed(1)},${yFor(w.balance).toFixed(1)}`).join(" ");
  const areaPath =
    `M${xFor(0).toFixed(1)},${yFor(0).toFixed(1)} ` +
    weekly.map((w, i) => `L${xFor(i).toFixed(1)},${yFor(w.balance).toFixed(1)}`).join(" ") +
    ` L${xFor(n - 1).toFixed(1)},${yFor(0).toFixed(1)} Z`;

  const step = n > 14 ? 2 : 1;
  const yTicks = 4;
  const zeroY = yFor(0);

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="trajFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.16} />
          <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0} />
        </linearGradient>
      </defs>
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
      <path d={areaPath} fill="url(#trajFill)" />
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke={COLORS.expense} strokeWidth={1} strokeDasharray="3 3" />
      <polyline points={points} fill="none" stroke={COLORS.accent} strokeWidth={2.75} />
      {weekly.map((w, i) => (
        <circle key={w.week} cx={xFor(i)} cy={yFor(w.balance)} r={4} fill={COLORS.ink} stroke="white" strokeWidth={1.5} />
      ))}
      {weekly.map((w, i) =>
        i % step === 0 ? (
          <text key={w.week} x={xFor(i)} y={H - 6} fontSize={10} fill={COLORS.inkMuted} textAnchor="middle">
            W{w.week}
          </text>
        ) : null
      )}
    </svg>
  );
}
