import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Bar Chart ────────────────────────────────────────────────────────────────

export interface BarSeries {
  name: string;
  data: number[];
  color: string;
}

interface BarChartProps {
  categories: string[];
  series: BarSeries[];
  height?: number;
  formatValue?: (val: number) => string;
}

export function AppBarChart({
  categories,
  series,
  height = 280,
  formatValue,
}: BarChartProps) {
  const chartData = categories.map((label, i) => {
    const entry: Record<string, string | number> = { label };
    series.forEach((s) => {
      entry[s.name] = s.data[i] ?? 0;
    });
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--text-muted, #6b7280)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatValue}
          tick={{ fontSize: 11, fill: "var(--text-muted, #6b7280)" }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatValue ? formatValue(value) : value,
            name,
          ]}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border, #e5e7eb)",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Bar key={s.name} dataKey={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Donut / Pie Chart ────────────────────────────────────────────────────────

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  height?: number;
  totalLabel?: string;
  formatValue?: (val: number) => string;
}

export function AppDonutChart({
  slices,
  height = 260,
  totalLabel = "Total",
  formatValue,
}: DonutChartProps) {
  const total = slices.reduce((s, i) => s + i.value, 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="45%"
          innerRadius="52%"
          outerRadius="72%"
          paddingAngle={2}
          label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
          labelLine={false}
        >
          {slices.map((s, idx) => (
            <Cell key={idx} fill={s.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [
            formatValue ? formatValue(value) : value,
            name,
          ]}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border, #e5e7eb)",
            fontSize: 12,
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(value) => <span style={{ color: "var(--text-muted, #6b7280)" }}>{value}</span>}
        />
        {/* Center label */}
        <text
          x="50%"
          y="45%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 11, fill: "var(--text-muted, #6b7280)" }}
        >
          {totalLabel}
        </text>
        <text
          x="50%"
          y="calc(45% + 18px)"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 12, fontWeight: 600, fill: "var(--text, #111827)" }}
        >
          {formatValue ? formatValue(total) : total}
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}

