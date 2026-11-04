export interface PricePoint {
  time: string;
  price: number;
}

const WIDTH = 640;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 34, left: 56 };

/**
 * Price history over research runs, as a plain SVG line chart (no chart library in this app).
 * The target price, when set, is drawn as a dashed reference line.
 */
export const PriceHistoryChart = ({
  points,
  targetPrice,
  currency,
}: {
  points: PricePoint[];
  targetPrice?: number | null;
  currency?: string | null;
}) => {
  if (points.length === 0) {
    return <p className="rounded bg-gray-50 p-4 text-sm text-gray-500">No price data yet — run a research.</p>;
  }

  const prices = points.map((p) => p.price);
  const values = targetPrice != null ? [...prices, targetPrice] : prices;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = max === min ? Math.max(1, max * 0.05) : (max - min) * 0.15;
  const yMin = min - pad;
  const yMax = max + pad;

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (price: number) => PAD.top + innerH - ((price - yMin) / (yMax - yMin)) * innerH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const fmtPrice = (v: number) => `${v.toFixed(2)}${currency ? ` ${currency}` : ""}`;

  const gridYs = [0, 0.5, 1].map((f) => yMin + f * (yMax - yMin));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Price history">
      {gridYs.map((gy, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={gy} y2={gy} stroke="#e5e7eb" strokeWidth="1" />
          <text x={PAD.left - 6} y={gy + 4} textAnchor="end" fontSize="10" fill="#6b7280">
            {fmtPrice(yMin + (i / 2) * (yMax - yMin))}
          </text>
        </g>
      ))}
      {targetPrice != null && (
        <g>
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(targetPrice)}
            y2={y(targetPrice)}
            stroke="#16a34a"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <text x={WIDTH - PAD.right} y={y(targetPrice) - 5} textAnchor="end" fontSize="10" fill="#16a34a">
            target {fmtPrice(targetPrice)}
          </text>
        </g>
      )}
      <path d={line} fill="none" stroke="#111827" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.price)} r="3.5" fill="#111827">
          <title>{`${fmtDate(p.time)} — ${fmtPrice(p.price)}`}</title>
        </circle>
      ))}
      <text x={PAD.left} y={HEIGHT - 10} fontSize="10" fill="#6b7280">
        {fmtDate(points[0]!.time)}
      </text>
      <text x={WIDTH - PAD.right} y={HEIGHT - 10} textAnchor="end" fontSize="10" fill="#6b7280">
        {fmtDate(points[points.length - 1]!.time)}
      </text>
    </svg>
  );
};
