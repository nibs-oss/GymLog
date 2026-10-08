import Link from "next/link";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchLoggedSets } from "@/lib/history";
import { getUserSettings, unitFor } from "@/lib/settings";
import { addDaysIso, phIsoDate } from "@/lib/fitness";
import { personalRecords } from "@/lib/records";
import { formatWeight, toDisplay, type Units } from "@/lib/units";

/** Records set within this many days get a "New" badge */
const NEW_DAYS = 14;

function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function setText(weight: number | null, reps: number | null, units: Units) {
  const w = weight !== null ? `${toDisplay(weight, units)} ${units}` : "Bodyweight";
  return reps !== null ? `${w} × ${reps}` : w;
}

export default async function RecordsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [rows, settings] = await Promise.all([
    fetchLoggedSets(supabase, user.id),
    getUserSettings(supabase, user.id),
  ]);
  const records = personalRecords(rows);
  const newSince = addDaysIso(phIsoDate(), -(NEW_DAYS - 1));

  return (
    <section className="space-y-6">
      <div>
        <Link href="/progress" className="text-sm text-slate-400 hover:text-foreground">
          ← Back to Progress
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Personal Records</h1>
        <p className="mt-1 text-sm text-slate-400">Your best lift for every exercise, newest records first.</p>
      </div>

      {records.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center">
          <p className="text-slate-400">No records yet. Log a workout to set your first ones.</p>
          <Link
            href="/log"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-accent/90"
          >
            Log Workout
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {records.map((r) => {
            // Each exercise in its own unit (e.g. dumbbells in lbs)
            const units = unitFor(r.name, settings.units, settings.exercise_units);
            const isNew = r.lastRecordDate >= newSince;
            const stats = [
              r.heaviest && {
                label: "Heaviest",
                value: formatWeight(r.heaviest.weight, units),
                detail: `× ${r.heaviest.reps ?? "–"} · ${shortDate(r.heaviest.date)}`,
              },
              r.best1RM && {
                label: "Est. 1RM",
                value: formatWeight(r.best1RM.value, units),
                detail: `${setText(r.best1RM.weight, r.best1RM.reps, units)} · ${shortDate(r.best1RM.date)}`,
              },
              r.mostReps && {
                label: "Most reps",
                value: `${r.mostReps.reps} reps`,
                detail: `${r.mostReps.weight !== null ? formatWeight(r.mostReps.weight, units) : "Bodyweight"} · ${shortDate(r.mostReps.date)}`,
              },
            ].filter((s) => !!s);

            return (
              <Link
                key={r.name}
                href={`/progress/${encodeURIComponent(r.name)}`}
                className="group block rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition-colors hover:border-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate font-medium text-foreground group-hover:text-accent">{r.name}</h2>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isNew && (
                      <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-slate-950">New</span>
                    )}
                    {r.muscle && (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400">
                        {r.muscle}
                      </span>
                    )}
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2">
                  {stats.map((s) => (
                    <div key={s.label} className="min-w-0">
                      <dt className="text-xs text-slate-500">{s.label}</dt>
                      <dd className="truncate font-semibold tabular-nums">{s.value}</dd>
                      <dd className="truncate text-[11px] text-slate-500">{s.detail}</dd>
                    </div>
                  ))}
                </dl>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
