"use client";

import { exerciseKey } from "@/lib/exercises";
import type { ExerciseSummary } from "@/lib/history";
import { INCREMENT, suggestNext } from "@/lib/progression";
import { toDisplay, toKg, type Units } from "@/lib/units";
import { emptySet, newKey, type WorkoutExercise } from "@/lib/workout";
import { ExerciseDatalist, ExerciseNameInput } from "./exercise-input";

const cell =
  "w-full min-w-0 rounded-lg border border-white/10 bg-slate-950 px-1 py-1.5 text-center text-sm tabular-nums text-foreground placeholder:text-slate-600";

/**
 * Editable list of exercises and sets.
 * - `history` adds a "last time" column and PR badges
 * - `onSetDone` adds a ✓ column (used to start the rest timer)
 * - `fixedNames` locks names for exercises that come from the routine
 * - `targetReps` (by exerciseKey) enables progressive overload suggestions
 * - `exerciseUnits` (by exerciseKey) overrides `units` per exercise; with
 *   `onExerciseUnitChange` each card gets a kg/lbs switch
 */
export function WorkoutEditor({
  exercises,
  onChange,
  units,
  history = {},
  onSetDone,
  knownNames = [],
  fixedNames = false,
  targetReps = {},
  exerciseUnits = {},
  onExerciseUnitChange,
}: {
  exercises: WorkoutExercise[];
  onChange: (next: WorkoutExercise[]) => void;
  units: Units;
  history?: Record<string, ExerciseSummary>;
  onSetDone?: () => void;
  knownNames?: string[];
  fixedNames?: boolean;
  targetReps?: Record<string, number>;
  exerciseUnits?: Record<string, Units>;
  onExerciseUnitChange?: (name: string, unit: Units) => void;
}) {
  const setEx = (i: number, patch: Partial<WorkoutExercise>) =>
    onChange(exercises.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)));

  const setSet = (i: number, j: number, patch: Partial<WorkoutExercise["sets"][number]>) =>
    setEx(i, { sets: exercises[i].sets.map((s, idx) => (idx === j ? { ...s, ...patch } : s)) });

  return (
    <div className="space-y-4">
      <ExerciseDatalist id="workout-exercises" known={knownNames} />
      {exercises.map((ex, i) => {
        const past = history[exerciseKey(ex.name)];
        // This exercise's unit (e.g. dumbbells in lbs while everything else is kg)
        const u = exerciseUnits[exerciseKey(ex.name)] ?? units;
        const best = past?.bestWeight ?? null;
        const locked = fixedNames && ex.key.startsWith("r-");
        const suggestion = past
          ? suggestNext(
              past.lastSets.map((s) => ({ weight: toDisplay(s.weight, u), reps: s.reps })),
              targetReps[exerciseKey(ex.name)] ?? null,
              INCREMENT[u],
              u
            )
          : null;
        const suggestionText = suggestion
          ? suggestion.weight !== null
            ? `${suggestion.weight} ${u} × ${suggestion.reps}`
            : `${suggestion.reps} reps`
          : "";
        const applied =
          suggestion !== null &&
          ex.sets.every(
            (s) =>
              s.done ||
              ((suggestion.weight === null || Number(s.weight) === suggestion.weight) &&
                Number(s.reps) === suggestion.reps)
          );
        return (
          <div key={ex.key} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="mb-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {locked ? (
                  <h2 className="truncate text-lg font-medium text-foreground">{ex.name}</h2>
                ) : (
                  <ExerciseNameInput
                    listId="workout-exercises"
                    value={ex.name}
                    onChange={(name) => setEx(i, { name })}
                    muscle={ex.muscle_group}
                    onMuscleChange={(muscle_group) => setEx(i, { muscle_group })}
                  />
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {ex.muscle_group && locked ? `${ex.muscle_group} · ` : ""}
                  {best !== null ? `Best: ${toDisplay(best, u)} ${u}` : "No history yet"}
                  {past?.lastDate ? ` · Last: ${past.lastDate}` : ""}
                </p>
                {suggestion && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-400/5 px-2.5 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">Try {suggestionText}</p>
                      <p className="text-xs text-slate-400">{suggestion.reason}</p>
                    </div>
                    <button
                      type="button"
                      disabled={applied}
                      onClick={() =>
                        setEx(i, {
                          sets: ex.sets.map((s) =>
                            s.done
                              ? s
                              : {
                                  ...s,
                                  weight: suggestion.weight !== null ? String(suggestion.weight) : s.weight,
                                  reps: String(suggestion.reps),
                                }
                          ),
                        })
                      }
                      className="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold text-accent hover:bg-sky-400/10 disabled:text-slate-500 disabled:hover:bg-transparent"
                    >
                      {applied ? "Applied" : "Apply"}
                    </button>
                  </div>
                )}
              </div>
              {onExerciseUnitChange && ex.name.trim() && (
                <div
                  className="flex shrink-0 rounded-md border border-white/10 bg-slate-950 p-0.5"
                  title="Unit for this exercise only"
                >
                  {(["kg", "lbs"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      aria-pressed={u === unit}
                      aria-label={`${ex.name} in ${unit}`}
                      onClick={() => {
                        if (unit === u) return;
                        // Convert what's typed so the actual weight stays the same
                        setEx(i, {
                          sets: ex.sets.map((s) => {
                            const kg = s.weight.trim() === "" ? null : toKg(Number(s.weight), u);
                            return kg === null ? s : { ...s, weight: String(toDisplay(kg, unit)) };
                          }),
                        });
                        onExerciseUnitChange(ex.name, unit);
                      }}
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        u === unit ? "bg-accent text-slate-950" : "text-slate-400 hover:text-foreground"
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => onChange(exercises.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${ex.name || "exercise"}`}
                className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-red-500/10 hover:text-red-400"
              >
                ✕
              </button>
            </div>

            {/* Header */}
            <div
              className={`grid items-center gap-2 px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500 ${
                onSetDone ? "grid-cols-[1.5rem_3.25rem_1fr_1fr_2.25rem_1.25rem]" : "grid-cols-[1.5rem_3.25rem_1fr_1fr_1.25rem]"
              }`}
            >
              <span>Set</span>
              <span className="text-center">Last</span>
              <span className="text-center">{u}</span>
              <span className="text-center">Reps</span>
              {onSetDone && <span className="text-center">✓</span>}
              <span />
            </div>

            <div className="space-y-1.5">
              {ex.sets.map((s, j) => {
                const last = past?.lastSets[j];
                const lastText =
                  last && (last.weight !== null || last.reps !== null)
                    ? `${last.weight !== null ? toDisplay(last.weight, u) : "–"} × ${last.reps ?? "–"}`
                    : "—";
                const typed = Number(s.weight);
                const isPR = best !== null && s.weight !== "" && typed > (toDisplay(best, u) ?? Infinity);
                return (
                  <div
                    key={s.key}
                    className={`grid items-center gap-2 rounded-lg px-1 py-0.5 ${
                      onSetDone ? "grid-cols-[1.5rem_3.25rem_1fr_1fr_2.25rem_1.25rem]" : "grid-cols-[1.5rem_3.25rem_1fr_1fr_1.25rem]"
                    } ${s.done ? "bg-sky-400/10" : ""}`}
                  >
                    <span className="text-sm font-medium text-slate-400">{j + 1}</span>
                    <button
                      type="button"
                      title="Use last time's numbers"
                      disabled={!last}
                      onClick={() =>
                        last &&
                        setSet(i, j, {
                          weight: last.weight !== null ? String(toDisplay(last.weight, u)) : s.weight,
                          reps: last.reps !== null ? String(last.reps) : s.reps,
                        })
                      }
                      className="truncate rounded-md py-1 text-center text-xs tabular-nums text-slate-400 enabled:hover:bg-white/5 enabled:hover:text-accent"
                    >
                      {lastText}
                    </button>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        placeholder="0"
                        aria-label={`Set ${j + 1} weight`}
                        value={s.weight}
                        onChange={(e) => setSet(i, j, { weight: e.target.value })}
                        className={`${cell} ${isPR ? "border-amber-400/60" : ""}`}
                      />
                      {isPR && (
                        <span className="pointer-events-none absolute -top-2 right-0 rounded bg-amber-400 px-1 text-[9px] font-bold text-slate-950">
                          PR
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="0"
                      aria-label={`Set ${j + 1} reps`}
                      value={s.reps}
                      onChange={(e) => setSet(i, j, { reps: e.target.value })}
                      className={cell}
                    />
                    {onSetDone && (
                      <button
                        type="button"
                        aria-label={`Mark set ${j + 1} done`}
                        aria-pressed={s.done}
                        onClick={() => {
                          setSet(i, j, { done: !s.done });
                          if (!s.done) onSetDone();
                        }}
                        className={`flex h-8 w-9 items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                          s.done
                            ? "border-accent bg-accent text-slate-950"
                            : "border-white/10 text-slate-500 hover:border-accent hover:text-accent"
                        }`}
                      >
                        ✓
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEx(i, { sets: ex.sets.filter((_, idx) => idx !== j) })}
                      disabled={ex.sets.length === 1}
                      aria-label={`Remove set ${j + 1}`}
                      className="text-xs text-slate-600 hover:text-red-400 disabled:opacity-0"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                const prev = ex.sets[ex.sets.length - 1];
                setEx(i, { sets: [...ex.sets, emptySet(prev?.weight ?? "", prev?.reps ?? "")] });
              }}
              className="mt-3 w-full rounded-lg border border-dashed border-white/10 py-1.5 text-sm text-slate-400 hover:border-sky-400/40 hover:text-accent"
            >
              + Add Set
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() =>
          onChange([
            ...exercises,
            { key: `x-${newKey()}`, name: "", muscle_group: null, sets: [emptySet()] },
          ])
        }
        className="w-full rounded-xl border border-dashed border-sky-400/40 py-2.5 text-sm font-medium text-accent hover:bg-sky-400/10"
      >
        + Add Exercise
      </button>
    </div>
  );
}
