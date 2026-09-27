"use client";

import { EXERCISE_LIBRARY, MUSCLE_GROUPS, exerciseKey, libraryMuscle } from "@/lib/exercises";

export const inputClass =
  "rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-sm text-foreground placeholder:text-slate-600";

/** One <datalist> per page: the user's own exercises first, then the library. */
export function ExerciseDatalist({ id, known = [] }: { id: string; known?: string[] }) {
  const seen = new Set<string>();
  const names = [...known, ...EXERCISE_LIBRARY.map((e) => e.name)].filter((n) => {
    const k = exerciseKey(n);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <datalist id={id}>
      {names.map((n) => (
        <option key={n} value={n} />
      ))}
    </datalist>
  );
}

/** Exercise name with autocomplete; fills in the muscle group for library exercises. */
export function ExerciseNameInput({
  listId,
  value,
  onChange,
  muscle,
  onMuscleChange,
  className = "",
}: {
  listId: string;
  value: string;
  onChange: (name: string) => void;
  muscle?: string | null;
  onMuscleChange?: (muscle: string | null) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 sm:flex-row ${className}`}>
      <input
        type="text"
        required
        list={listId}
        value={value}
        placeholder="Exercise name"
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          const m = libraryMuscle(e.target.value);
          if (m && onMuscleChange && !muscle) onMuscleChange(m);
        }}
        className={`${inputClass} min-w-0 flex-1`}
      />
      {onMuscleChange && (
        <select
          value={muscle ?? ""}
          onChange={(e) => onMuscleChange(e.target.value || null)}
          aria-label="Muscle group"
          className={`${inputClass} sm:w-36`}
        >
          <option value="">Muscle…</option>
          {MUSCLE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
