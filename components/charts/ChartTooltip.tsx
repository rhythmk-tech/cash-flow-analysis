// Renders a small SVG tooltip box near (x, y), clamped so it never runs off the edge of the
// chart's viewBox. Text is monospace so width can be estimated from character count.
export function ChartTooltip({
  x,
  y,
  lines,
  viewW,
  viewH,
}: {
  x: number;
  y: number;
  lines: string[];
  viewW: number;
  viewH: number;
}) {
  const padX = 8;
  const padY = 6;
  const lineHeight = 14;
  const charWidth = 6.4;
  const width = Math.max(...lines.map((l) => l.length)) * charWidth + padX * 2;
  const height = lines.length * lineHeight + padY * 2 - 3;

  let boxX = x + 12;
  let boxY = y - height - 12;
  if (boxX + width > viewW - 4) boxX = x - width - 12;
  if (boxX < 4) boxX = 4;
  if (boxY < 4) boxY = y + 14;
  if (boxY + height > viewH - 4) boxY = viewH - height - 4;

  return (
    <g pointerEvents="none">
      <rect x={boxX} y={boxY} width={width} height={height} rx={6} fill="#12151C" fillOpacity={0.95} />
      {lines.map((line, i) => (
        <text
          key={i}
          x={boxX + padX}
          y={boxY + padY + (i + 1) * lineHeight - 3}
          fontSize={11}
          fill="#fff"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight={i === 0 ? 700 : 400}
        >
          {line}
        </text>
      ))}
    </g>
  );
}
