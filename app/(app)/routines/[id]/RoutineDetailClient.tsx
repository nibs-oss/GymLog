"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/utils/supabase/client";
import { canonicalExerciseName } from "@/lib/exercises";
import { useKnownExercises } from "@/lib/use-known-exercises";
import {
  RoutineExerciseEditor,
  type EditableExercise,
} from "@/components/routine-exercise-editor";
import { errorMessage } from "@/lib/errors";

// Types for the data received from the server component
interface Routine {
  id: string;
  name: string;
  created_at: string;
}

interface Exercise {
  id: string;
  name: string;
  position: number;
  default_sets: number;
  default_reps: number;
  muscle_group: string | null;
}

// ---------------------------------------------------------------
// Edit form
// ---------------------------------------------------------------
function EditRoutine({
  routine,
  exercises,
  onDone,
}: {
  routine: Routine;
  exercises: Exercise[];
  onDone: () => void;
}) {
  const router = useRouter();
  const knownNames = useKnownExercises();
  const [name, setName] = useState(routine.name);
  const [items, setItems] = useState<EditableExercise[]>(() =>
    exercises.map((ex) => ({
      key: ex.id,
      id: ex.id,
      name: ex.name,
      muscle_group: ex.muscle_group,
      default_sets: Number(ex.default_sets),
      default_reps: Number(ex.default_reps),
    }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Routine name cannot be empty.");
    if (items.length === 0) return setError("Add at least one exercise.");
    if (items.some((ex) => !ex.name.trim())) return setError("Exercise names cannot be empty.");

    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error: routineErr } = await supabase
        .from("routines")
        .update({ name: name.trim() })
        .eq("id", routine.id);
      if (routineErr) throw routineErr;

      const rows = items.map((ex, idx) => ({
        routine_id: routine.id,
        name: canonicalExerciseName(ex.name, knownNames),
        muscle_group: ex.muscle_group,
        position: idx + 1,
        default_sets: ex.default_sets,
        default_reps: ex.default_reps,
      }));

      // Update existing rows, insert new ones (kept separate so new rows never send id: null)
      const existing = items
        .map((ex, idx) => (ex.id ? { id: ex.id, ...rows[idx] } : null))
        .filter((r): r is NonNullable<typeof r> => r !== null);
      const added = rows.filter((_, idx) => !items[idx].id);

      if (existing.length) {
        const { error: upErr } = await supabase
          .from("routine_exercises")
          .upsert(existing, { onConflict: "id" });
        if (upErr) throw upErr;
      }
      if (added.length) {
        const { error: insErr } = await supabase.from("routine_exercises").insert(added);
        if (insErr) throw insErr;
      }

      const keptIds = new Set(items.map((ex) => ex.id).filter(Boolean));
      const toDelete = exercises.map((ex) => ex.id).filter((id) => !keptIds.has(id));
      if (toDelete.length) {
        const { error: delErr } = await supabase
          .from("routine_exercises")
          .delete()
          .in("id", toDelete);
        if (delErr) throw delErr;
      }

      router.refresh();
      onDone();
    } catch (err) {
      setError(errorMessage(err, "An unexpected error occurred."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6"
    >
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400">
          {error}
        </p>
      )}
      <label className="block">
        <span className="block text-sm font-medium text-slate-300">Routine Name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-foreground"
        />
      </label>
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-foreground">Exercises</h2>
        <RoutineExerciseEditor items={items} onChange={setItems} knownNames={knownNames} />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-accent/90 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save Changes"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onDone}
          className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------
// Detail view
// ---------------------------------------------------------------
export default function RoutineDetailClient({
  routine,
  exercises,
}: {
  routine: Routine;
  exercises: Exercise[];
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [busy, setBusy] = useState<"delete" | "duplicate" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm("Delete this routine? Your logged workouts are kept.")) return;
    setBusy("delete");
    setActionError(null);
    try {
      // The database cascades this: routine_exercises are deleted and past
      // workout_sessions keep their history with routine_id set to null.
      // (see supabase/repair.sql)
      const supabase = createBrowserClient();
      const { data: deleted, error } = await supabase
        .from("routines")
        .delete()
        .eq("id", routine.id)
        .select("id");
      if (error) throw error;
      if (!deleted?.length) {
        throw new Error("Routine could not be deleted (no permission or already deleted).");
      }
      router.push("/routines");
      router.refresh();
    } catch (err) {
      const message = errorMessage(err, "Failed to delete routine.");
      console.error("Delete routine failed:", message);
      setActionError(message);
      setBusy(null);
    }
  };

  const handleDuplicate = async () => {
    setBusy("duplicate");
    setActionError(null);
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: copy, error } = await supabase
        .from("routines")
        .insert({ name: `${routine.name} (copy)`, user_id: user.id })
        .select("id")
        .single();
      if (error) throw error;
      if (exercises.length) {
        const { error: exErr } = await supabase.from("routine_exercises").insert(
          exercises.map((ex) => ({
            routine_id: copy.id,
            name: ex.name,
            muscle_group: ex.muscle_group,
            position: ex.position,
            default_sets: ex.default_sets,
            default_reps: ex.default_reps,
          }))
        );
        if (exErr) throw exErr;
      }
      router.push(`/routines/${copy.id}`);
      router.refresh();
    } catch (err) {
      setActionError(errorMessage(err, "Failed to duplicate routine."));
      setBusy(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/routines"
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-foreground"
        >
          ← Back to Routines
        </Link>
        {!isEditing && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/log/${routine.id}`}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-accent/90"
            >
              Start Workout
            </Link>
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/5"
            >
              Edit
            </button>
            <button
              onClick={handleDuplicate}
              disabled={busy !== null}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/5 disabled:opacity-60"
            >
              {busy === "duplicate" ? "Duplicating…" : "Duplicate"}
            </button>
            <button
              onClick={handleDelete}
              disabled={busy !== null}
              className="rounded-lg px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-60"
            >
              {busy === "delete" ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400">
          {actionError}
        </p>
      )}

      {isEditing ? (
        <EditRoutine routine={routine} exercises={exercises} onDone={() => setIsEditing(false)} />
      ) : (
        <>
          <h1 className="text-2xl font-semibold text-foreground">{routine.name}</h1>
          <ol className="space-y-2">
            {exercises.map((ex, idx) => (
              <li
                key={ex.id}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-slate-900/60 p-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-sm font-semibold text-accent">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{ex.name}</p>
                  <p className="text-sm text-slate-400">
                    {ex.default_sets} sets × {ex.default_reps} reps
                  </p>
                </div>
                {ex.muscle_group && (
                  <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-slate-300">
                    {ex.muscle_group}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
