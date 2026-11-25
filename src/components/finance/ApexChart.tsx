import { useEffect, useRef } from "react";
import ApexCharts, { type ApexOptions } from "apexcharts";

interface ApexChartProps {
  options: ApexOptions;
  series: ApexOptions["series"];
  type: NonNullable<ApexOptions["chart"]>["type"];
  height?: number;
}

export function ApexChart({
  options,
  series,
  type,
  height = 280,
}: ApexChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ApexCharts | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const mergedOptions: ApexOptions = {
      ...options,
      series,
      chart: {
        ...options.chart,
        type,
        height,
        background: "transparent",
        fontFamily: "DM Sans, sans-serif",
        toolbar: { show: false },
      },
    };

    const chart = new ApexCharts(el, mergedOptions);
    chartRef.current = chart;
    void chart.render();

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [options, series, type, height]);

  return <div ref={containerRef} className="apex-chart-container" />;
}
