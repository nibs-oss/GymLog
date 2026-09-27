"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = "rgb(148 163 184)"; // slate-400: recessive axis text
const GRID = "rgb(255 255 255 / 0.06)";

function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  labelFormat,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit: string;
  labelFormat?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-400">{label ? (labelFormat ? labelFormat(label) : label) : ""}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {payload[0].value.toLocaleString()} {unit}
      </p>
    </div>
  );
}

/** Single-series line over time: 2px line, ≥8px markers, crosshair tooltip. */
export function TrendChart({
  data,
  unit,
  label,
}: {
  data: { date: string; value: number }[];
  unit: string;
  label: string;
}) {
  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-slate-400">No data for this period.</p>;
  }
  return (
    <div className="h-64 w-full" role="img" aria-label={`${label} over time`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            stroke={AXIS}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            stroke={AXIS}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={["auto", "auto"]}
          />
          <Tooltip
            cursor={{ stroke: "rgb(255 255 255 / 0.25)", strokeWidth: 1 }}
            content={<ChartTooltip unit={unit} labelFormat={shortDate} />}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke="var(--accent)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--accent)", stroke: "var(--background)", strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: "var(--background)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal single-hue bars (magnitude by category), value labels at bar ends. */
export function CategoryBars({
  data,
  unit,
}: {
  data: { name: string; value: number }[];
  unit: string;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No sets logged in this period.</p>;
  }
  return (
    <div style={{ height: Math.max(120, data.length * 34 + 16) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            stroke={AXIS}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={88}
          />
          <Tooltip cursor={{ fill: "rgb(255 255 255 / 0.04)" }} content={<ChartTooltip unit={unit} />} />
          <Bar
            dataKey="value"
            fill="var(--accent)"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            label={{ position: "right", fill: "rgb(203 213 225)", fontSize: 12 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
