"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/utils/supabase/client";
import { WorkoutEditor } from "@/components/workout-editor";
import { RestTimer, primeRestAudio } from "@/components/rest-timer";
import { achievementInfo, awardAchievements } from "@/lib/achievements";
import { exerciseKey } from "@/lib/exercises";
import { phIsoDate, setVolume } from "@/lib/fitness";
import type { ExerciseSummary } from "@/lib/history";
import { formatWeight, toDisplay, type Units } from "@/lib/units";
import {
  cleanWorkout,
  emptySet,
  findLogOnDate,
  findPRs,
  insertSessionExercises,
  type WorkoutExercise,
} from "@/lib/workout";
import { errorMessage } from "@/lib/errors";

interface RoutineExercise {
  id: string;
  name: string;
  position: number;
  default_sets: number;
  default_reps: number;
  muscle_group: string | null;
}

interface Summary {
  sessionId: string;
  exercises: number;
  sets: number;
  volume: number; // kg
  prs: { name: string; weight: number; previous: number }[];
  achievements: string[];
}

export default function LogSessionClient({
  routine,
  exercises,
  units,
  weeklyGoal,
  history,
}: {
  routine: { id: string; name: string };
  exercises: RoutineExercise[];
  units: Units;
  weeklyGoal: number;
  history: Record<string, ExerciseSummary>;
}) {
  const router = useRouter();
  const knownNames = useMemo(() => Object.values(history).map((h) => h.name), [history]);

  const [workout, setWorkout] = useState<WorkoutExercise[]>(() =>
    exercises.map((ex) => {
      const past = history[exerciseKey(ex.name)];
      return {
        key: `r-${ex.id}`,
        name: ex.name,
        muscle_group: ex.muscle_group ?? past?.muscle ?? null,
        sets: Array.from({ length: Math.max(1, ex.default_sets) }, (_, j) => {
          const last = past?.lastSets[j] ?? past?.lastSets[past.lastSets.length - 1];
          const w = last?.weight != null ? String(toDisplay(last.weight, units)) : "";
          return emptySet(w, ex.default_reps ? String(ex.default_reps) : "");
        }),
      };
    })
  );
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const doneSets = workout.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
  const totalSets = workout.reduce((n, ex) => n + ex.sets.length, 0);

  const finishWorkout = async () => {
    setError(null);
    const clean = cleanWorkout(workout, units, knownNames);
    if (!clean.length) {
      setError("Fill in at least one set before finishing.");
      return;
    }
    setSaving(true);
    let sessionId: string | null = null;
    const supabase = createBrowserClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const today = phIsoDate();
      if (await findLogOnDate(supabase, user.id, today)) {
        throw new Error("You already logged a workout or rest day today.");
      }

      const { data: sessionData, error: sessErr } = await supabase
        .from("workout_sessions")
        .insert({
          user_id: user.id,
          routine_id: routine.id,
          date: today,
          is_rest_day: false,
        })
        .select("id")
        .single();
      if (sessErr) throw sessErr;
      sessionId = sessionData.id as string;

      await insertSessionExercises(supabase, sessionId, clean);

      const priorBest = Object.fromEntries(
        Object.entries(history).map(([k, h]) => [k, h.bestWeight])
      );
      const prs = findPRs(clean, priorBest);
      const earned = await awardAchievements(supabase, user.id, {
        prCount: prs.length,
        weeklyGoal,
      });

      setSummary({
        sessionId,
        exercises: clean.length,
        sets: clean.reduce((n, ex) => n + ex.sets.length, 0),
        volume: clean.reduce(
          (v, ex) => v + ex.sets.reduce((sv, s) => sv + setVolume(s.weight, s.reps), 0),
          0
        ),
        prs,
        achievements: earned,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } catch (err) {
      // Don't leave a half-saved empty session behind
      if (sessionId) await supabase.from("workout_sessions").delete().eq("id", sessionId);
      setError(errorMessage(err, "Failed to save workout."));
    } finally {
      setSaving(false);
    }
  };

  if (summary) {
    return (
      <section className="mx-auto max-w-xl space-y-5">
        <div className="rounded-2xl border border-sky-400/25 bg-gradient-to-br from-sky-500/20 via-sky-400/5 to-transparent p-6 text-center">
          <p className="text-4xl">🎉</p>
          <h1 className="mt-2 text-2xl font-semibold">Workout saved!</h1>
          <p className="mt-1 text-sm text-slate-400">{routine.name}</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ["Exercises", String(summary.exercises)],
              ["Sets", String(summary.sets)],
              ["Volume", formatWeight(summary.volume, units)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-950/50 p-3">
                <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {summary.prs.length > 0 && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5">
            <h2 className="font-medium text-foreground">🏆 New personal bests</h2>
            <ul className="mt-3 space-y-2">
              {summary.prs.map((pr) => (
                <li key={pr.name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-200">{pr.name}</span>
                  <span className="tabular-nums text-slate-400">
                    {formatWeight(pr.previous, units)} →{" "}
                    <span className="font-semibold text-foreground">{formatWeight(pr.weight, units)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.achievements.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <h2 className="font-medium text-foreground">Achievements unlocked</h2>
            <ul className="mt-3 space-y-2">
              {summary.achievements.map((a) => {
                const info = achievementInfo(a);
                return (
                  <li key={a} className="flex items-center gap-3 text-sm">
                    <span className="text-xl">{info.icon}</span>
                    <span>
                      <span className="font-medium text-foreground">{info.title}</span>
                      <span className="text-slate-400"> — {info.description}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href="/"
            className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-semibold text-slate-950 hover:bg-accent/90"
          >
            Done
          </Link>
          <Link
            href={`/history/${summary.sessionId}`}
            className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-center text-sm font-medium text-foreground hover:bg-white/5"
          >
            View / edit
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Link href="/log" className="text-sm text-slate-400 hover:text-foreground">
            ← Back
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{routine.name}</h1>
        </div>
        <p className="text-sm tabular-nums text-slate-400">
          {doneSets}/{totalSets} sets
        </p>
      </div>

      <p className="text-xs text-slate-500">
        Tap a <span className="text-slate-300">Last</span> value to copy it. Tick ✓ after each set to start the rest timer.
      </p>

      <WorkoutEditor
        exercises={workout}
        onChange={setWorkout}
        units={units}
        history={history}
        onSetDone={() => {
          primeRestAudio();
          setRestStartedAt(Date.now());
        }}
        knownNames={knownNames}
        fixedNames
      />

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400">{error}</p>
      )}

      <button
        type="button"
        onClick={finishWorkout}
        disabled={saving}
        className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-accent/90 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Finish Workout"}
      </button>

      <RestTimer key={restStartedAt ?? 0} startedAt={restStartedAt} />
    </section>
  );
}
