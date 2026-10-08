import type { HeatCell } from "@/lib/heatmap";
import { formatWeight, type Units } from "@/lib/units";

const CELL = 11; // px
const GAP = 3;
const SHADE = [0, 0.3, 0.5, 0.75, 1];
const ROW_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

function cellTitle(c: HeatCell, units: Units) {
  const day = new Date(`${c.date}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  if (c.level) return `${day}: workout${c.volume ? `, ${formatWeight(c.volume, units)}` : ""}`;
  if (c.rest) return `${day}: rest day`;
  return day;
}

/** Year of training days, GitHub-style. Scrolls horizontally on phones, newest weeks in view. */
export function WorkoutHeatmap({
  weeks,
  months,
  units,
}: {
  weeks: HeatCell[][];
  months: { week: number; label: string }[];
  units: Units;
}) {
  const workouts = weeks.flat().filter((c) => c.level > 0).length;
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium text-foreground">Consistency</h2>
        <span className="text-xs text-slate-500">
          {workouts} {workouts === 1 ? "workout" : "workouts"} in the last year
        </span>
      </div>
      <div className="mt-4 flex gap-2">
        {/* Weekday labels stay put while the grid scrolls */}
        <div className="flex shrink-0 flex-col pt-5 text-[10px] text-slate-500" style={{ gap: GAP }}>
          {ROW_LABELS.map((l, i) => (
            <span key={i} style={{ height: CELL, lineHeight: `${CELL}px` }}>
              {l}
            </span>
          ))}
        </div>
        {/* rtl container starts scrolled to the newest (right-hand) weeks */}
        <div className="min-w-0 flex-1 overflow-x-auto pb-1" dir="rtl">
          <div dir="ltr" className="relative inline-block pt-5">
            {months.map((m) => (
              <span
                key={m.week}
                className="absolute top-0 text-[10px] text-slate-500"
                style={{ left: m.week * (CELL + GAP) }}
              >
                {m.label}
              </span>
            ))}
            <div className="flex" style={{ gap: GAP }}>
              {weeks.map((col) => (
                <div key={col[0].date} className="flex flex-col" style={{ gap: GAP }}>
                  {col.map((c) => (
                    <div
                      key={c.date}
                      title={c.future ? undefined : cellTitle(c, units)}
                      className={`rounded-[3px] ${
                        c.future ? "" : c.level ? "" : c.rest ? "bg-slate-600/70" : "bg-slate-800/70"
                      }`}
                      style={{
                        width: CELL,
                        height: CELL,
                        ...(c.level && !c.future ? { background: "var(--accent)", opacity: SHADE[c.level] } : {}),
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block rounded-[3px] bg-slate-600/70" style={{ width: CELL, height: CELL }} />
          Rest day
        </span>
        <span className="flex items-center gap-1">
          Less
          {SHADE.slice(1).map((o) => (
            <span
              key={o}
              className="inline-block rounded-[3px]"
              style={{ width: CELL, height: CELL, background: "var(--accent)", opacity: o }}
            />
          ))}
          More volume
        </span>
      </div>
    </div>
  );
}
