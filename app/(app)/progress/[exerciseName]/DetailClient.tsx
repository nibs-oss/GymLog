"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrendChart } from "@/components/charts";
import { estimate1RM, localIsoDate, setVolume } from "@/lib/fitness";
import { formatWeight, toDisplay, type Units } from "@/lib/units";

interface SetRecord {
  sessionId: string;
  date: string; // YYYY-MM-DD
  setNumber: number;
  weight: number | null; // kg
  reps: number | null;
}

type Metric = "top" | "e1rm" | "volume";
type Range = "all" | "1m" | "3m" | "1y";

const METRICS: { key: Metric; label: string; hint: string }[] = [
  { key: "top", label: "Top weight", hint: "Heaviest set each session" },
  { key: "e1rm", label: "Est. 1RM", hint: "Best estimated one-rep max (Epley) each session" },
  { key: "volume", label: "Volume", hint: "Total weight × reps each session" },
];

export default function DetailClient({
  name,
  units,
  records,
}: {
  name: string;
  units: Units;
  records: SetRecord[];
}) {
  const [range, setRange] = useState<Range>("all");
  const [metric, setMetric] = useState<Metric>("top");

  const filtered = useMemo(() => {
    if (range === "all") return records;
    const cutoff = new Date();
    if (range === "1y") cutoff.setFullYear(cutoff.getFullYear() - 1);
    else cutoff.setMonth(cutoff.getMonth() - (range === "1m" ? 1 : 3));
    const iso = localIsoDate(cutoff);
    return records.filter((r) => r.date >= iso);
  }, [records, range]);

  // One entry per session
  const sessions = useMemo(() => {
    const map = new Map<string, { date: string; sessionId: string; sets: SetRecord[] }>();
    for (const r of filtered) {
      if (!map.has(r.sessionId)) map.set(r.sessionId, { date: r.date, sessionId: r.sessionId, sets: [] });
      map.get(r.sessionId)!.sets.push(r);
    }
    return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [filtered]);

  const chartData = useMemo(
    () =>
      sessions
        .map((s) => {
          let kg = 0;
          for (const set of s.sets) {
            const v =
              metric === "top"
                ? set.weight ?? 0
                : metric === "e1rm"
                  ? estimate1RM(set.weight, set.reps) ?? 0
                  : setVolume(set.weight, set.reps);
            kg = metric === "volume" ? kg + v : Math.max(kg, v);
          }
          return { date: s.date, value: toDisplay(kg, units) ?? 0 };
        })
        .filter((p) => p.value > 0),
    [sessions, metric, units]
  );

  const allTime = useMemo(() => {
    let top = 0;
    let e1rm = 0;
    let bestSet: SetRecord | null = null;
    for (const r of records) {
      if ((r.weight ?? 0) > top) top = r.weight ?? 0;
      const e = estimate1RM(r.weight, r.reps) ?? 0;
      if (e > e1rm) {
        e1rm = e;
        bestSet = r;
      }
    }
    return { top, e1rm, bestSet };
  }, [records]);

  const first = chartData[0]?.value;
  const last = chartData[chartData.length - 1]?.value;
  const change = first && last && chartData.length > 1 ? ((last - first) / first) * 100 : null;
  const current = METRICS.find((m) => m.key === metric)!;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>

      {records.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center text-slate-400">
          No sets logged for this exercise yet.
        </div>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400">Personal best</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatWeight(allTime.top, units)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400">Est. 1RM</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatWeight(allTime.e1rm, units)}</p>
              {allTime.bestSet && (
                <p className="text-[11px] text-slate-500">
                  from {toDisplay(allTime.bestSet.weight, units)} × {allTime.bestSet.reps}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400">Change</p>
              <p
                className={`mt-1 text-lg font-semibold tabular-nums ${
                  change === null ? "" : change >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {change === null ? "—" : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(0)}%`}
              </p>
              <p className="text-[11px] text-slate-500">{current.label.toLowerCase()}, this range</p>
            </div>
          </div>

          {/* Controls: one row above the chart */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex rounded-lg border border-white/10 bg-slate-950 p-1">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  aria-pressed={metric === m.key}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    metric === m.key ? "bg-accent text-slate-950" : "text-slate-400 hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-white/10 bg-slate-950 p-1">
              {(
                [
                  ["1m", "1M"],
                  ["3m", "3M"],
                  ["1y", "1Y"],
                  ["all", "All"],
                ] as [Range, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setRange(key)}
                  aria-pressed={range === key}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    range === key ? "bg-sky-400/15 text-accent" : "text-slate-400 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="mb-2 text-sm font-medium text-slate-300">
              {current.label} <span className="font-normal text-slate-500">· {current.hint} ({units})</span>
            </p>
            <TrendChart data={chartData} unit={units} label={current.label} />
          </div>

          {/* Session list (doubles as the table view of the chart) */}
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Sessions</h2>
            {[...sessions].reverse().map((s) => (
              <Link
                key={s.sessionId}
                href={`/history/${s.sessionId}`}
                className="block rounded-xl border border-white/10 bg-slate-900/60 p-3 transition-colors hover:border-accent"
              >
                <p className="text-sm text-slate-400">
                  {new Date(`${s.date}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {s.sets.map((set) => (
                    <span
                      key={set.setNumber}
                      className={`rounded-md px-2 py-0.5 text-sm tabular-nums ${
                        set.weight !== null && set.weight === allTime.top
                          ? "bg-amber-400/15 text-amber-200"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {toDisplay(set.weight, units) ?? "—"} × {set.reps ?? "—"}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
            {sessions.length === 0 && <p className="text-slate-400">No data for this period.</p>}
          </div>
        </>
      )}
    </div>
  );
}
