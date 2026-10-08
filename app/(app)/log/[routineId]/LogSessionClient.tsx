"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
  saveWorkout,
  type WorkoutExercise,
} from "@/lib/workout";
import { errorMessage } from "@/lib/errors";
import { addPending, isNetworkError, loadPending } from "@/lib/pending";
import { useWakeLock } from "@/lib/use-wake-lock";
import { ShareWorkoutButton } from "@/components/share-workout-button";

interface RoutineExercise {
  id: string;
  name: string;
  position: number;
  default_sets: number;
  default_reps: number;
  muscle_group: string | null;
}

/** Unfinished workout kept on this device so a closed tab or reload doesn't lose it */
interface Draft {
  workout: WorkoutExercise[];
  restStartedAt: number | null;
  savedAt: number;
}

const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const draftKey = (routineId: string) => `gymlog.workoutDraft.${routineId}`;

function loadDraft(routineId: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(routineId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (!Array.isArray(draft.workout) || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(draftKey(routineId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function saveDraft(routineId: string, draft: Draft) {
  try {
    localStorage.setItem(draftKey(routineId), JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the workout still works, it just isn't kept
  }
}

function clearDraft(routineId: string) {
  try {
    localStorage.removeItem(draftKey(routineId));
  } catch {}
}

interface Summary {
  sessionId: string | null; // null = saved on this phone, waiting to upload
  exercises: number;
  sets: number;
  volume: number; // kg
  prs: { name: string; weight: number; previous: number }[];
  achievements: string[];
}

type Props = {
  routine: { id: string; name: string };
  exercises: RoutineExercise[];
  units: Units;
  weeklyGoal: number;
  history: Record<string, ExerciseSummary>;
};

const noopSubscribe = () => () => {};

/** Renders only in the browser, so the saved draft can be read on first render. */
export default function LogSessionClient(props: Props) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return <p className="text-center text-sm text-slate-400">Loading workout…</p>;
  return <LogSession {...props} />;
}

function LogSession({
  routine,
  exercises,
  units,
  weeklyGoal,
  history,
}: Props) {
  const router = useRouter();
  const knownNames = useMemo(() => Object.values(history).map((h) => h.name), [history]);
  // The routine's rep target per exercise drives the progressive overload suggestion
  const targetReps = useMemo(
    () =>
      Object.fromEntries(
        exercises.filter((ex) => ex.default_reps > 0).map((ex) => [exerciseKey(ex.name), ex.default_reps])
      ),
    [exercises]
  );

  const initialWorkout = (): WorkoutExercise[] =>
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
    });
  const [draft] = useState(() => loadDraft(routine.id));
  const [workout, setWorkout] = useState<WorkoutExercise[]>(() => draft?.workout ?? initialWorkout());
  const [restStartedAt, setRestStartedAt] = useState<number | null>(draft?.restStartedAt ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(draft !== null);
  // Only keep a draft once the user has actually changed something
  const dirty = useRef(draft !== null);
  // Don't let the phone lock between sets while the workout is open
  useWakeLock(!summary);

  useEffect(() => {
    if (!dirty.current || summary) return;
    saveDraft(routine.id, { workout, restStartedAt, savedAt: Date.now() });
  }, [routine.id, workout, restStartedAt, summary]);

  const updateWorkout = (next: WorkoutExercise[]) => {
    dirty.current = true;
    setWorkout(next);
  };

  const discardDraft = () => {
    clearDraft(routine.id);
    dirty.current = false;
    setWorkout(initialWorkout());
    setRestStartedAt(null);
    setRestoredDraft(false);
  };

  const doneSets = workout.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
  const totalSets = workout.reduce((n, ex) => n + ex.sets.length, 0);

  const finishWorkout = async () => {
    setError(null);
    const clean = cleanWorkout(workout, units, knownNames);
    if (!clean.length) {
      setError("Fill in at least one set before finishing.");
      return;
    }
    const today = phIsoDate();
    if (loadPending().some((w) => w.date === today)) {
      setError("You already finished a workout today. It's saved on this phone, waiting to upload.");
      return;
    }
    setSaving(true);
    const supabase = createBrowserClient();

    const priorBest = Object.fromEntries(Object.entries(history).map(([k, h]) => [k, h.bestWeight]));
    const totals = {
      prs: findPRs(clean, priorBest),
      exercises: clean.length,
      sets: clean.reduce((n, ex) => n + ex.sets.length, 0),
      volume: clean.reduce(
        (v, ex) => v + ex.sets.reduce((sv, s) => sv + setVolume(s.weight, s.reps), 0),
        0
      ),
    };

    // No connection: keep the finished workout on this phone; PendingSync uploads it later
    const saveOnPhone = () => {
      addPending({ routineId: routine.id, routineName: routine.name, date: today, exercises: clean });
      clearDraft(routine.id);
      setSummary({ sessionId: null, ...totals, achievements: [] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    try {
      if (!navigator.onLine) return saveOnPhone();
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr && isNetworkError(authErr)) throw authErr;
      if (!user) throw new Error("Not authenticated");
      if (await findLogOnDate(supabase, user.id, today)) {
        throw new Error("You already logged a workout or rest day today.");
      }

      const sessionId = await saveWorkout(supabase, {
        sessionId: null,
        routineId: routine.id,
        date: today,
        exercises: clean,
      });
      clearDraft(routine.id);

      // The workout is already saved; an achievements hiccup shouldn't report it as failed
      const earned = await awardAchievements(supabase, user.id, {
        prCount: totals.prs.length,
        weeklyGoal,
      }).catch(() => [] as string[]);

      setSummary({ sessionId, ...totals, achievements: earned });
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } catch (err) {
      if (isNetworkError(err)) saveOnPhone();
      else setError(errorMessage(err, "Failed to save workout."));
    } finally {
      setSaving(false);
    }
  };

  if (summary) {
    return (
      <section className="mx-auto max-w-xl space-y-5">
        <div className="rounded-2xl border border-sky-400/25 bg-gradient-to-br from-sky-500/20 via-sky-400/5 to-transparent p-6 text-center">
          <p className="text-4xl">{summary.sessionId ? "🎉" : "📶"}</p>
          <h1 className="mt-2 text-2xl font-semibold">
            {summary.sessionId ? "Workout saved!" : "Saved on this phone"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{routine.name}</p>
          {!summary.sessionId && (
            <p className="mt-2 text-sm text-amber-300">
              No connection right now. It&apos;ll upload automatically when you&apos;re back online.
            </p>
          )}
          {summary.sessionId && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <ShareWorkoutButton
                sessionId={summary.sessionId}
                className="rounded-lg border border-sky-400/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-sky-400/10 disabled:opacity-60"
              />
            </div>
          )}
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
          {summary.sessionId && (
            <Link
              href={`/history/${summary.sessionId}`}
              className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-center text-sm font-medium text-foreground hover:bg-white/5"
            >
              View / edit
            </Link>
          )}
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

      {restoredDraft && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
          <span>Restored your unfinished workout.</span>
          <button type="button" onClick={discardDraft} className="shrink-0 text-xs text-slate-300 underline hover:text-foreground">
            Start over
          </button>
        </div>
      )}

      <WorkoutEditor
        exercises={workout}
        onChange={updateWorkout}
        units={units}
        history={history}
        onSetDone={() => {
          dirty.current = true;
          primeRestAudio();
          setRestStartedAt(Date.now());
        }}
        knownNames={knownNames}
        fixedNames
        targetReps={targetReps}
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
