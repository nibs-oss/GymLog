"use client";

import { useMemo, useState } from "react";
import { CategoryBars } from "@/components/charts";
import { MuscleMap, RECOVERY_COLOR, RECOVERY_LABEL } from "@/components/muscle-map";
import { addDaysIso as addDays } from "@/lib/fitness";
import { RECOVERY_GROUPS, type MuscleRecovery } from "@/lib/recovery";

/** "Sat 2:00 PM" in Philippine time */
function readyText(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

/** Sets per muscle group for a chosen week (weeks[0] = this week), or recovery right now. */
export default function MuscleVolume({
  weeks,
  sets,
  today,
  recovery,
}: {
  weeks: string[];
  sets: { date: string; muscle: string }[];
  today: string;
  recovery: Record<string, MuscleRecovery>;
}) {
  const [range, setRange] = useState<"this" | "last" | "avg4" | "recovery">("this");

  const data = useMemo(() => {
    let from: string, to: string, divide = 1;
    if (range === "this" || range === "recovery") {
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
    ["recovery", "Recovery"],
  ];

  // Not yet recovered first (soonest ready first); untrained muscles count as fresh
  const notReady = Object.entries(recovery)
    .filter(([, r]) => r.status !== "fresh")
    .sort((a, b) => (a[1].readyAt < b[1].readyAt ? -1 : 1));
  const fresh = RECOVERY_GROUPS.filter((g) => !recovery[g] || recovery[g].status === "fresh");

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">Muscles trained</h2>
          <p className="text-xs text-slate-500">
            {range === "recovery"
              ? "Estimated from when you last trained each muscle and how hard. A guide, not a rule."
              : "Aim for roughly 10–20 hard sets per muscle each week."}
          </p>
        </div>
        <div className="flex flex-wrap rounded-lg border border-white/10 bg-slate-950 p-1">
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
      {range === "recovery" ? (
        <div className="grid items-center gap-4 md:grid-cols-2">
          <MuscleMap recovery={Object.fromEntries(Object.entries(recovery).map(([g, r]) => [g, r.status]))} />
          <div className="space-y-3 text-sm">
            {notReady.length > 0 && (
              <ul className="space-y-1.5">
                {notReady.map(([group, r]) => (
                  <li key={group} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: RECOVERY_COLOR[r.status] }} />
                      <span className="text-foreground">{group}</span>
                      <span className="text-xs text-slate-500">{RECOVERY_LABEL[r.status]}</span>
                    </span>
                    <span className="text-xs tabular-nums text-slate-400">ready {readyText(r.readyAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-slate-400">
              <span className="font-medium" style={{ color: RECOVERY_COLOR.fresh }}>
                Fresh:
              </span>{" "}
              {fresh.length ? fresh.join(", ") : "nothing yet, everything is still recovering"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid items-center gap-4 md:grid-cols-2">
          <MuscleMap counts={Object.fromEntries(data.map((d) => [d.name, d.value]))} />
          <CategoryBars data={data} unit="sets" />
        </div>
      )}
    </div>
  );
}
