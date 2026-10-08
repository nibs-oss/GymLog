import Link from "next/link";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchLoggedSets } from "@/lib/history";
import { getUserSettings } from "@/lib/settings";
import { addMonthsIso, phIsoDate } from "@/lib/fitness";
import { monthRecap } from "@/lib/recap";
import { formatWeight } from "@/lib/units";

function monthLabel(month: string) {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "▲ 12% vs month before", or the plain difference when `absolute` */
function Change({ now, before, absolute = false }: { now: number; before: number; absolute?: boolean }) {
  if (!before) return null;
  const diff = now - before;
  const pct = Math.round((diff / before) * 100);
  return (
    <span className={`text-xs tabular-nums ${diff >= 0 ? "text-emerald-400" : "text-slate-400"}`}>
      {diff >= 0 ? "▲" : "▼"} {absolute ? Math.abs(diff) : `${Math.abs(pct)}%`} vs month before
    </span>
  );
}

/** Monthly training report; defaults to last month. */
export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const thisMonth = phIsoDate().slice(0, 7);
  const lastMonth = addMonthsIso(`${thisMonth}-01`, -1).slice(0, 7);
  const { month: requested } = await searchParams;
  const month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) && requested <= thisMonth ? requested : lastMonth;

  const [rows, settings, { data: sessions }] = await Promise.all([
    fetchLoggedSets(supabase, user.id),
    getUserSettings(supabase, user.id),
    supabase.from("workout_sessions").select("date, is_rest_day").eq("user_id", user.id),
  ]);
  const units = settings.units;
  const gymDates = (sessions ?? []).filter((s) => !s.is_rest_day).map((s) => s.date as string);
  const restDates = (sessions ?? []).filter((s) => s.is_rest_day).map((s) => s.date as string);
  const r = monthRecap(rows, gymDates, restDates, month);

  const prev = addMonthsIso(`${month}-01`, -1).slice(0, 7);
  const next = addMonthsIso(`${month}-01`, 1).slice(0, 7);

  const tiles = [
    { label: "Workouts", value: String(r.workouts), change: <Change now={r.workouts} before={r.previousWorkouts} absolute /> },
    { label: "Volume", value: formatWeight(r.volume, units), change: <Change now={r.volume} before={r.previousVolume} /> },
    { label: "Sets", value: String(r.sets), change: null },
    { label: "Longest streak", value: `${r.longestStreak} ${r.longestStreak === 1 ? "day" : "days"}`, change: null },
    { label: "Rest days", value: String(r.restDays), change: null },
    { label: "New PRs", value: r.prs.length ? `🏆 ${r.prs.length}` : "0", change: null },
  ];

  return (
    <section className="space-y-6">
      <div>
        <Link href="/progress" className="text-sm text-slate-400 hover:text-foreground">
          ← Back to Progress
        </Link>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">📊 {monthLabel(month)}</h1>
          <div className="flex gap-1">
            <Link
              href={`/progress/report?month=${prev}`}
              aria-label="Previous month"
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
            >
              ‹
            </Link>
            {next <= thisMonth && (
              <Link
                href={`/progress/report?month=${next}`}
                aria-label="Next month"
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
              >
                ›
              </Link>
            )}
          </div>
        </div>
        {month === thisMonth && <p className="mt-1 text-sm text-slate-400">This month so far.</p>}
      </div>

      {r.workouts === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center text-slate-400">
          No workouts logged in {monthLabel(month)}.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-500">{t.label}</p>
                <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{t.value}</p>
                {t.change}
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <h2 className="font-medium text-foreground">Most trained</h2>
              {r.topMuscles.length > 0 && (
                <p className="mt-2 text-sm text-slate-300">
                  <span className="text-slate-500">Muscles:</span> {r.topMuscles.join(", ")}
                </p>
              )}
              <ul className="mt-2 space-y-1 text-sm">
                {r.topExercises.map((ex) => (
                  <li key={ex.name} className="flex justify-between gap-3">
                    <span className="truncate text-slate-300">{ex.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-400">{ex.sets} sets</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <h2 className="font-medium text-foreground">New personal records</h2>
              {r.prs.length ? (
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  {r.prs.map((name) => (
                    <li key={name}>🏆 {name}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-400">No new heaviest lifts this month.</p>
              )}
              <Link href="/progress/records" className="mt-3 inline-block text-sm text-accent hover:underline">
                All records →
              </Link>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
