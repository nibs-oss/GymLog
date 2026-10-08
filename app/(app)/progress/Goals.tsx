"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { canonicalExerciseName } from "@/lib/exercises";
import { phIsoDate } from "@/lib/fitness";
import type { GoalProgress, LiftGoal } from "@/lib/goals";
import { saveSettingsPatch } from "@/lib/save-settings";
import { unitFor } from "@/lib/settings";
import { formatWeight, toKg, type Units } from "@/lib/units";

const MAX_GOALS = 6;

function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function statusText(p: GoalProgress, units: Units) {
  if (p.achievedOn) return `Achieved on ${shortDate(p.achievedOn)}`;
  if (p.currentKg === null) return p.goal.reps > 1 ? `No sets of ${p.goal.reps}+ reps logged yet` : "Not logged yet";
  if (p.eta) {
    const rate = formatWeight(p.kgPerWeek!, units);
    return `About ${shortDate(p.eta)} at your current pace (+${rate}/week)`;
  }
  if (p.etaTooFar) return "Over 2 years away at your current pace";
  if (p.kgPerWeek !== null) return "No progress in the last 8 weeks";
  return "Log a few more sessions for an estimate";
}

/** Lift goals with progress and an estimated date from the recent trend. */
export default function Goals({
  progress,
  goals,
  knownExercises,
  units,
  exerciseUnits,
}: {
  progress: GoalProgress[];
  goals: LiftGoal[];
  knownExercises: string[];
  units: Units;
  exerciseUnits: Record<string, Units>;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [exercise, setExercise] = useState("");
  const [target, setTarget] = useState("");
  const [reps, setReps] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unit = exercise.trim() ? unitFor(exercise, units, exerciseUnits) : units;

  const save = async (next: LiftGoal[]) => {
    setBusy(true);
    setError(null);
    const err = await saveSettingsPatch(createClient(), {
      // Starting points are worked out from history, so they aren't stored
      lift_goals: next.map(({ id, exercise, targetKg, reps, createdAt }) => ({ id, exercise, targetKg, reps, createdAt })),
    });
    setBusy(false);
    if (err) {
      setError(err);
      return false;
    }
    router.refresh();
    return true;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = canonicalExerciseName(exercise, knownExercises);
    const targetKg = toKg(Number(target), unit);
    const repsN = Math.max(1, Math.round(Number(reps) || 1));
    if (!name || !targetKg || targetKg <= 0) return setError("Enter an exercise and a target weight.");
    const ok = await save([
      ...goals,
      { id: crypto.randomUUID(), exercise: name, targetKg, reps: repsN, startKg: null, createdAt: phIsoDate() },
    ]);
    if (ok) {
      setExercise("");
      setTarget("");
      setReps("1");
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this goal?")) return;
    await save(goals.filter((g) => g.id !== id));
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">Goals</h2>
          <p className="text-xs text-slate-500">Estimates use your trend over the last 8 weeks.</p>
        </div>
        {!adding && goals.length < MAX_GOALS && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium hover:bg-white/5"
          >
            Add goal
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={add} className="mt-4 grid gap-2 sm:grid-cols-[1fr_7rem_5rem_auto]">
          <input
            list="goal-exercises"
            required
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            placeholder="Exercise, e.g. Bench Press"
            className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-foreground placeholder:text-slate-600"
          />
          <datalist id="goal-exercises">
            {knownExercises.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <label className="relative">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Target"
              aria-label={`Target weight in ${unit}`}
              className="w-full rounded-lg border border-white/10 bg-slate-950 py-2 pl-3 pr-10 text-sm text-foreground placeholder:text-slate-600"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">
              {unit}
            </span>
          </label>
          <label className="relative">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              required
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              aria-label="Reps"
              className="w-full rounded-lg border border-white/10 bg-slate-950 py-2 pl-3 pr-10 text-sm text-foreground"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">
              reps
            </span>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-accent/90 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {progress.length === 0 && !adding ? (
        <p className="mt-4 text-sm text-slate-400">
          Set a target like Bench Press 100 kg, and see how close you are and when you&apos;ll get there.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {progress.map((p) => {
            const u = unitFor(p.goal.exercise, units, exerciseUnits);
            const done = !!p.achievedOn;
            return (
              <li key={p.goal.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate font-medium text-foreground">
                    {p.goal.exercise}{" "}
                    <span className="font-normal text-slate-400">
                      {formatWeight(p.goal.targetKg, u)}
                      {p.goal.reps > 1 ? ` × ${p.goal.reps}` : ""}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => remove(p.goal.id)}
                    disabled={busy}
                    aria-label={`Remove goal ${p.goal.exercise}`}
                    className="shrink-0 text-xs text-slate-500 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${done ? "bg-emerald-400" : "bg-accent"}`}
                    style={{ width: `${Math.round(p.progress * 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs">
                  <span className="tabular-nums text-slate-400">
                    {p.currentKg !== null ? `Best ${formatWeight(p.currentKg, u)}` : "—"} ·{" "}
                    {Math.round(p.progress * 100)}%
                  </span>
                  <span className={done ? "text-emerald-400" : "text-slate-500"}>{statusText(p, u)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
