export const CurveChart = () => {
  const w = 360;
  const h = 130;
  const p = 18;
  const pts = [];
  for (let lv = 0; lv <= 50; lv += 2) {
    const xp = 1000 * lv + 250 * lv * lv;
    pts.push([lv, xp]);
  }
  const max = pts[pts.length - 1][1];
  const path = pts
    .map((pt, i) => {
      const x = p + (pt[0] / 50) * (w - p * 2);
      const y = h - p - (pt[1] / max) * (h - p * 2);
      return (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
    })
    .join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id="cv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={p}
          x2={w - p}
          y1={h - p - f * (h - p * 2)}
          y2={h - p - f * (h - p * 2)}
          stroke="var(--line-soft)"
          strokeDasharray="2 4"
        />
      ))}
      <path d={path + ` L ${w - p},${h - p} L ${p},${h - p} Z`} fill="url(#cv)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      {[1, 10, 30, 50].map((lv) => {
        const xp = 1000 * lv + 250 * lv * lv;
        const x = p + (lv / 50) * (w - p * 2);
        const y = h - p - (xp / max) * (h - p * 2);
        return (
          <g key={lv}>
            <circle cx={x} cy={y} r="3" fill="var(--accent)" />
            <text
              x={x}
              y={y - 8}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize="9"
              fill="var(--fg-2)"
            >
              Lv.{lv}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
