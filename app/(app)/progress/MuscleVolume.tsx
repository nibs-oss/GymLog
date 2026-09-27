"use client";

import { useMemo, useState } from "react";
import { CategoryBars } from "@/components/charts";

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sets per muscle group, for a chosen week (weeks[0] = this week). */
export default function MuscleVolume({
  weeks,
  sets,
  today,
}: {
  weeks: string[];
  sets: { date: string; muscle: string }[];
  today: string;
}) {
  const [range, setRange] = useState<"this" | "last" | "avg4">("this");

  const data = useMemo(() => {
    let from: string, to: string, divide = 1;
    if (range === "this") {
      from = weeks[0];
      to = today;
    } else if (range === "last") {
      from = weeks[1];
      to = addDays(weeks[0], -1);
    } else {
      from = weeks[weeks.length - 1];
      to = addDays(weeks[0], -1);
      divide = weeks.length - 1 || 1;
    }
    const counts = new Map<string, number>();
    for (const s of sets) {
      if (s.date >= from && s.date <= to) counts.set(s.muscle, (counts.get(s.muscle) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, n]) => ({ name, value: Math.round((n / divide) * 10) / 10 }))
      .sort((a, b) => b.value - a.value);
  }, [range, weeks, sets, today]);

  const tabs: [typeof range, string][] = [
    ["this", "This week"],
    ["last", "Last week"],
    ["avg4", "3-week avg"],
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">Sets per muscle group</h2>
          <p className="text-xs text-slate-500">Aim for roughly 10–20 hard sets per muscle each week.</p>
        </div>
        <div className="flex rounded-lg border border-white/10 bg-slate-950 p-1">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              aria-pressed={range === key}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                range === key ? "bg-accent text-slate-950" : "text-slate-400 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <CategoryBars data={data} unit="sets" />
    </div>
  );
}
