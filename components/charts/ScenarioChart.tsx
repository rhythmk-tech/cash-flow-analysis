import { COLORS, ScenarioPoint } from "@/lib/forecast";

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
      <polyline points={toPoints(bear)} fill="none" stroke={COLORS.expense} strokeWidth={2} strokeDasharray="6 4" />
      <polyline points={toPoints(base)} fill="none" stroke={COLORS.ink} strokeWidth={2.5} />
      <polyline points={toPoints(bull)} fill="none" stroke={COLORS.income} strokeWidth={2} strokeDasharray="1 4" strokeLinecap="round" />
      {base.map((w, i) =>
        i % step === 0 ? (
          <text key={w.week} x={xFor(i)} y={H - 6} fontSize={10} fill={COLORS.inkMuted} textAnchor="middle">
            W{w.week}
          </text>
        ) : null
      )}
    </svg>
  );
}
