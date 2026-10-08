import Link from "next/link";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchLoggedSets, summariseByExercise } from "@/lib/history";
import { getUserSettings, unitFor } from "@/lib/settings";
import { addDaysIso, estimate1RM, phIsoDate, setVolume, weekStartIso } from "@/lib/fitness";
import { exerciseKey, libraryMuscle } from "@/lib/exercises";
import { formatWeight } from "@/lib/units";
import MuscleVolume from "./MuscleVolume";
import { buildHeatmap } from "@/lib/heatmap";
import { WorkoutHeatmap } from "@/components/workout-heatmap";

async function fetchProgress() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [rows, settings, { data: restRows }] = await Promise.all([
    fetchLoggedSets(supabase, user.id),
    getUserSettings(supabase, user.id),
    supabase.from("workout_sessions").select("date").eq("user_id", user.id).eq("is_rest_day", true),
  ]);

  const summaries = summariseByExercise(rows);
  const best1RM = new Map<string, number>();
  for (const r of rows) {
    const e = estimate1RM(r.weight, r.reps);
    const k = exerciseKey(r.exercise);
    if (e !== null && e > (best1RM.get(k) ?? 0)) best1RM.set(k, e);
  }

  const exercises = [...summaries.entries()]
    .map(([key, s]) => ({ ...s, best1RM: best1RM.get(key) ?? null }))
    .sort((a, b) => ((b.lastDate ?? "") < (a.lastDate ?? "") ? -1 : 1));

  // Hard sets per muscle group for the last 4 weeks (Mon-based), newest first
  const weeks: string[] = [];
  const thisWeek = weekStartIso();
  for (let i = 0; i < 4; i++) weeks.push(addDaysIso(thisWeek, -7 * i));
  const oldest = weeks[weeks.length - 1];
  const muscleSets = rows
    .filter((r) => r.date >= oldest)
    .map((r) => ({
      date: r.date,
      muscle: r.muscle ?? libraryMuscle(r.exercise) ?? "Other",
    }));

  const volumeByDate = new Map<string, number>();
  for (const r of rows) volumeByDate.set(r.date, (volumeByDate.get(r.date) ?? 0) + setVolume(r.weight, r.reps));
  const heatmap = buildHeatmap(volumeByDate, new Set((restRows ?? []).map((r) => r.date as string)), phIsoDate());

  return {
    heatmap,
    exercises,
    units: settings.units,
    exerciseUnits: settings.exercise_units,
    weeks,
    muscleSets,
    today: phIsoDate(),
  };
}

export default async function ProgressPage() {
  const data = await fetchProgress();
  if (!data) return null;
  const { heatmap, exercises, units, exerciseUnits, weeks, muscleSets, today } = data;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href="/progress/report"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5"
          >
            Report
          </Link>
          <Link
            href="/progress/records"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5"
          >
            Records
          </Link>
          <Link
            href="/bodyweight"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5"
          >
            Bodyweight
          </Link>
        </div>
      </div>

      {exercises.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center">
          <p className="text-slate-400">No exercises logged yet. Start by logging a workout.</p>
          <Link
            href="/log"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-accent/90"
          >
            Log Workout
          </Link>
        </div>
      ) : (
        <>
          <WorkoutHeatmap weeks={heatmap.weeks} months={heatmap.months} units={units} />

          <MuscleVolume weeks={weeks} sets={muscleSets} today={today} />


          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Exercises</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {exercises.map((ex) => (
                <Link
                  key={ex.name}
                  href={`/progress/${encodeURIComponent(ex.name)}`}
                  className="group block rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition-colors hover:border-accent hover:bg-slate-800/80"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-medium text-foreground group-hover:text-accent">{ex.name}</h3>
                    {ex.muscle && (
                      <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400">
                        {ex.muscle}
                      </span>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Best</dt>
                      <dd className="font-semibold tabular-nums">{formatWeight(ex.bestWeight, unitFor(ex.name, units, exerciseUnits))}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Est. 1RM</dt>
                      <dd className="font-semibold tabular-nums">{formatWeight(ex.best1RM, unitFor(ex.name, units, exerciseUnits))}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-slate-500">
                    {ex.sessionCount} {ex.sessionCount === 1 ? "session" : "sessions"} · last {ex.lastDate}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
