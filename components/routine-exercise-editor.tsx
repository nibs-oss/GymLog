"use client";

import { useState } from "react";
import { ExerciseDatalist, ExerciseNameInput, inputClass } from "./exercise-input";

export interface EditableExercise {
  key: string; // stable client key
  id?: string; // database id for existing rows
  name: string;
  muscle_group: string | null;
  default_sets: number;
  default_reps: number;
}

export function newEditableExercise(): EditableExercise {
  return {
    key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    muscle_group: null,
    default_sets: 2,
    default_reps: 8,
  };
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/** Exercise list with autocomplete, muscle groups, drag-to-reorder and ↑/↓ buttons. */
export function RoutineExerciseEditor({
  items,
  onChange,
  knownNames = [],
}: {
  items: EditableExercise[];
  onChange: (items: EditableExercise[]) => void;
  knownNames?: string[];
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // Only the ⠿ handle starts a drag, so text in the inputs stays selectable
  const [armed, setArmed] = useState<number | null>(null);

  const update = (i: number, patch: Partial<EditableExercise>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div className="space-y-3">
      <ExerciseDatalist id="exercise-library" known={knownNames} />
      {items.map((ex, idx) => (
        <div
          key={ex.key}
          draggable={armed === idx}
          onDragStart={(e) => {
            setDragIndex(idx);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOverIndex(idx);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null) onChange(move(items, dragIndex, idx));
            setDragIndex(null);
            setOverIndex(null);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setOverIndex(null);
            setArmed(null);
          }}
          className={`flex gap-3 rounded-xl border bg-slate-800/30 p-3 transition-colors ${
            overIndex === idx && dragIndex !== null && dragIndex !== idx
              ? "border-accent"
              : "border-white/10"
          } ${dragIndex === idx ? "opacity-50" : ""}`}
        >
          {/* Reorder controls */}
          <div className="flex flex-col items-center justify-center gap-1 text-slate-500">
            <button
              type="button"
              onClick={() => onChange(move(items, idx, idx - 1))}
              disabled={idx === 0}
              aria-label={`Move ${ex.name || "exercise"} up`}
              className="rounded px-1.5 text-xs hover:text-accent disabled:opacity-30"
            >
              ▲
            </button>
            <span
              onMouseDown={() => setArmed(idx)}
              onMouseUp={() => setArmed(null)}
              className="hidden cursor-grab select-none text-lg leading-none sm:block"
              title="Drag to reorder"
            >
              ⠿
            </span>
            <button
              type="button"
              onClick={() => onChange(move(items, idx, idx + 1))}
              disabled={idx === items.length - 1}
              aria-label={`Move ${ex.name || "exercise"} down`}
              className="rounded px-1.5 text-xs hover:text-accent disabled:opacity-30"
            >
              ▼
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <ExerciseNameInput
              listId="exercise-library"
              value={ex.name}
              onChange={(name) => update(idx, { name })}
              muscle={ex.muscle_group}
              onMuscleChange={(muscle_group) => update(idx, { muscle_group })}
            />
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <input
                type="number"
                min={1}
                required
                value={ex.default_sets}
                onChange={(e) => update(idx, { default_sets: Number(e.target.value) })}
                aria-label="Sets"
                className={`${inputClass} w-16`}
              />
              <span>sets ×</span>
              <input
                type="number"
                min={1}
                required
                value={ex.default_reps}
                onChange={(e) => update(idx, { default_reps: Number(e.target.value) })}
                aria-label="Reps"
                className={`${inputClass} w-16`}
              />
              <span>reps</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="ml-auto rounded-lg px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, newEditableExercise()])}
        className="rounded-lg border border-dashed border-sky-400/40 px-3 py-2 text-sm font-medium text-accent hover:bg-sky-400/10"
      >
        + Add Exercise
      </button>
    </div>
  );
}
