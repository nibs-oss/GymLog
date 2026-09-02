"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

interface SetRecord {
  date: string; // YYYY-MM-DD
  weight: number;
  reps: number;
  set_number: number;
}

export default function DetailClient({
  name,
  records,
  pb,
}: {
  name: string;
  records: SetRecord[];
  pb: number;
}) {
  const [filter, setFilter] = useState<"all" | "1m" | "3m">("all");

  // Compute filtered data based on the selected range
  const filtered = useMemo(() => {
    if (filter === "all") return records;
    const now = new Date();
    const cutoff = new Date();
    cutoff.setMonth(now.getMonth() - (filter === "1m" ? 1 : 3));
    const isoCutoff = cutoff.toISOString().split("T")[0];
    return records.filter((r) => r.date >= isoCutoff);
  }, [records, filter]);

  // For chart, we need one point per day: use the max weight of that day
  const chartData = useMemo(() => {
    const byDate: Record<string, number> = {};
    filtered.forEach((r) => {
      if (!byDate[r.date] || r.weight > byDate[r.date]) {
        byDate[r.date] = r.weight;
      }
    });
    // Convert to sorted array of {date, weight}
    return Object.entries(byDate)
      .map(([date, weight]) => ({ date, weight }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [filtered]);

  // Group sets by date for the table view
  const sessionsByDate = useMemo(() => {
    const map: Record<string, SetRecord[]> = {};
    filtered.forEach((r) => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });
    // Sort dates descending for recent first
    const sortedDates = Object.keys(map).sort((a, b) => (a < b ? 1 : -1));
    return sortedDates.map((date) => ({ date, sets: map[date] }));
  }, [filtered]);

  return (
    <section className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">{name} Progress</h1>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded px-3 py-1 text-sm ${filter === "all" ? "bg-accent text-black" : "bg-zinc-800 text-zinc-300"}`}
        >
          All Time
        </button>
        <button
          onClick={() => setFilter("1m")}
          className={`rounded px-3 py-1 text-sm ${filter === "1m" ? "bg-accent text-black" : "bg-zinc-800 text-zinc-300"}`}
        >
          Last Month
        </button>
        <button
          onClick={() => setFilter("3m")}
          className={`rounded px-3 py-1 text-sm ${filter === "3m" ? "bg-accent text-black" : "bg-zinc-800 text-zinc-300"}`}
        >
          Last 3 Months
        </button>
      </div>

      {/* Chart */}
      <div className="h-64 w-full rounded border border-white/10 bg-zinc-900/60 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" />
            <YAxis stroke="rgba(255,255,255,0.6)" />
            <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "none", color: "#fff" }} />
            <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        {/* PB marker */}
        {pb && (
          <p className="mt-2 text-sm text-zinc-400">
            Personal Best: {pb} kg
          </p>
        )}
      </div>

      {/* Sessions table */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">Sessions</h2>
        {sessionsByDate.map(({ date, sets }) => (
          <div key={date} className="rounded-lg border border-white/10 bg-zinc-900/60 p-3">
            <p className="text-sm text-zinc-400">{date}</p>
            <ul className="mt-1 list-disc list-inside text-sm text-zinc-300">
              {sets.map((s, idx) => (
                <li key={idx}>
                  Set {s.set_number}: {s.weight} kg × {s.reps} reps
                </li>
              ))}
            </ul>
          </div>
        ))}
        {sessionsByDate.length === 0 && (
          <p className="text-zinc-400">No data for this period.</p>
        )}
      </div>
    </section>
  );
}
