import { useEffect, useRef } from "react";

export interface PricePoint {
  time: string;
  price: number;
}

/**
 * Price history over research runs, rendered with ECharts (tree-shaken core build, loaded
 * dynamically so SSR never touches `window`). The target price, when set, is a dashed mark line.
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (points.length === 0) return;

    let chart: { setOption: (o: unknown) => void; resize: () => void; dispose: () => void } | undefined;
    let disposed = false;

    void (async () => {
      const echarts = await import("echarts/core");
      const { LineChart } = await import("echarts/charts");
      const { GridComponent, MarkLineComponent, TooltipComponent } = await import("echarts/components");
      const { CanvasRenderer } = await import("echarts/renderers");
      echarts.use([LineChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer]);

      if (disposed || !containerRef.current) return;
      chart = echarts.init(containerRef.current);

      const tooltip = currency ? { valueFormatter: (v: number) => `${Number(v).toFixed(2)} ${currency}` } : {};
      chart.setOption({
        animation: false,
        grid: { left: 56, right: 16, top: 24, bottom: 34 },
        tooltip: { trigger: "axis", ...tooltip },
        xAxis: {
          type: "category",
          data: points.map((p) => new Date(p.time).toLocaleString()),
          axisLabel: { fontSize: 10, hideOverlap: true },
        },
        yAxis: { type: "value", scale: true, axisLabel: { fontSize: 10 } },
        series: [
          {
            type: "line",
            data: points.map((p) => p.price),
            symbolSize: 7,
            lineStyle: { width: 2, color: "#fa500f" },
            itemStyle: { color: "#fa500f" },
            markLine:
              targetPrice != null
                ? {
                    silent: true,
                    symbol: "none",
                    lineStyle: { type: "dashed", color: "#16a34a" },
                    label: { formatter: `target ${targetPrice.toFixed(2)}${currency ? ` ${currency}` : ""}`, fontSize: 10, color: "#16a34a" },
                    data: [{ yAxis: targetPrice }],
                  }
                : undefined,
          },
        ],
      });

      const onResize = () => chart?.resize();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    })().catch(() => {
      // Chart failure must not break the page; the runs list below still shows the data.
    });

    return () => {
      disposed = true;
      chart?.dispose();
    };
  }, [points, targetPrice, currency]);

  if (points.length === 0) {
    return <p className="rounded bg-gray-50 p-4 text-sm text-gray-500">No price data yet — run a research.</p>;
  }

  return <div ref={containerRef} className="h-64 w-full" role="img" aria-label="Price history" />;
};
