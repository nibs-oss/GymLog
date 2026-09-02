"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/utils/supabase/client";

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
}

/**
 * Client‑side component handling edit/delete interactions.
 */
export default function RoutineDetailClient({
  routine,
  exercises,
}: {
  routine: Routine;
  exercises: Exercise[];
}) {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [isEditing, setIsEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ---------------------------------------------------------------
  // Delete handler
  // ---------------------------------------------------------------
  const handleDelete = async () => {
    if (!confirm("Delete this routine? This action cannot be undone."))
      return;
    setDeleting(true);
    setDeleteError(null);
    try {
      // Delete associated exercises first (FK safety)
      const { error: exErr } = await supabase
        .from("routine_exercises")
        .delete()
        .eq("routine_id", routine.id);
      if (exErr) throw exErr;

      const { error: routineErr } = await supabase
        .from("routines")
        .delete()
        .eq("id", routine.id);
      if (routineErr) throw routineErr;

      // Redirect to the list – the list page will fetch fresh data.
      router.push("/routines");
    } catch (err: any) {
      console.error(err);
      setDeleteError(err.message ?? "Failed to delete routine.");
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------------------------------------------
  // EditRoutine sub‑component (client side)
  // ---------------------------------------------------------------
  function EditRoutine({
    routine,
    exercises,
    onCancel,
  }: {
    routine: Routine;
    exercises: Exercise[];
    onCancel: () => void;
  }) {
    const [name, setName] = useState(routine.name);
    const [exList, setExList] = useState(
      exercises.map((ex) => ({
        ...ex,
        // Ensure numeric fields are numbers (Supabase may return strings)
        default_sets: Number(ex.default_sets),
        default_reps: Number(ex.default_reps),
      }))
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleExerciseChange = (
      index: number,
      field: keyof typeof exList[0],
      value: any
    ) => {
      setExList((prev) => {
        const copy = [...prev];
        // @ts-ignore – dynamic field assignment
        copy[index][field] = value;
        return copy;
      });
    };

    const addExercise = () => {
      setExList((prev) => [
        ...prev,
        {
          // temporary client‑side id – prefixed with "new-"
          id: `new-${Date.now()}`,
          name: "",
          position: prev.length + 1,
          default_sets: 3,
          default_reps: 10,
        },
      ]);
    };

    const removeExercise = (index: number) => {
      setExList((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!name.trim()) {
        setError("Routine name cannot be empty.");
        return;
      }
      if (exList.length === 0) {
        setError("Add at least one exercise.");
        return;
      }
      if (exList.some((ex) => !ex.name.trim())) {
        setError("Exercise names cannot be empty.");
        return;
      }

      setLoading(true);
      try {
        // Update routine name
        const { error: routineErr } = await supabase
          .from("routines")
          .update({ name: name.trim() })
          .eq("id", routine.id);
        if (routineErr) throw routineErr;

        // Determine deletions vs upserts
        const existingIds = exercises.map((ex) => ex.id);
        const currentIds = exList
          .filter(
            (ex) => typeof ex.id === "string" && !ex.id.startsWith("new-")
          )
          .map((ex) => ex.id as string);
        const toDelete = existingIds.filter((id) => !currentIds.includes(id));

        // Build payload for upsert (new rows get undefined id)
        const upsertPayload = exList.map((ex, idx) => ({
          id: ex.id?.toString().startsWith("new-") ? undefined : ex.id,
          routine_id: routine.id,
          name: ex.name.trim(),
          position: idx + 1,
          default_sets: ex.default_sets,
          default_reps: ex.default_reps,
        }));

        const { error: upsertErr } = await supabase
          .from("routine_exercises")
          .upsert(upsertPayload, { onConflict: "id" });
        if (upsertErr) throw upsertErr;

        // Delete any removed rows
        if (toDelete.length) {
          const { error: delErr } = await supabase
            .from("routine_exercises")
            .delete()
            .in("id", toDelete);
          if (delErr) throw delErr;
        }

        // Refresh server data so UI reflects the latest state.
        // router.refresh() re‑runs the server component that fetched the routine.
        router.refresh();
        // Exit edit mode after refresh.
        onCancel();
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    return (
      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-6 rounded-lg border border-white/10 bg-zinc-900/60 p-8"
      >
        {error && (
          <p className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400">
            {error}
          </p>
        )}
        <label className="block">
          <span className="block text-sm font-medium text-zinc-300">
            Routine Name
          </span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent"
          />
        </label>
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-foreground">Exercises</h2>
          {exList.map((ex, idx) => (
            <div
              key={ex.id}
              className="grid grid-cols-1 gap-2 rounded-lg border border-white/10 bg-zinc-800/30 p-4 md:grid-cols-4"
            >
              <input
                type="text"
                required
                value={ex.name}
                onChange={(e) =>
                  handleExerciseChange(idx, "name", e.target.value)
                }
                placeholder="Exercise name"
                className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent"
              />
              <input
                type="number"
                min={1}
                required
                value={ex.default_sets}
                onChange={(e) =>
                  handleExerciseChange(
                    idx,
                    "default_sets",
                    Number(e.target.value)
                  )
                }
                className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent"
                placeholder="Sets"
              />
              <input
                type="number"
                min={1}
                required
                value={ex.default_reps}
                onChange={(e) =>
                  handleExerciseChange(
                    idx,
                    "default_reps",
                    Number(e.target.value)
                  )
                }
                className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent"
                placeholder="Reps"
              />
              <button
                type="button"
                onClick={() => removeExercise(idx)}
                className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addExercise}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-black hover:bg-accent/90"
          >
            + Add Exercise
          </button>
        </div>
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-black hover:bg-accent/90 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save Changes"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  // ---------------------------------------------------------------
  // Render static view or edit form based on isEditing
  // ---------------------------------------------------------------
  return (
    <section className="space-y-6">
      {/* Header navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/routines"
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-foreground"
        >
          ← Back to Routines
        </Link>
        <div className="flex gap-3">
          <button
            onClick={() => setIsEditing((v) => !v)}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent/90"
          >
            {isEditing ? "Cancel Edit" : "Edit"}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete Routine"}
          </button>
        </div>
      </div>

      {deleteError && (
        <p className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400">
          {deleteError}
        </p>
      )}

      {isEditing ? (
        <EditRoutine
          routine={routine}
          exercises={exercises}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <>
          <h1 className="text-2xl font-semibold text-foreground">
            {routine.name}
          </h1>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {exercises.map((ex) => (
              <div
                key={ex.id}
                className="rounded-lg border border-white/10 bg-zinc-900/60 p-4"
              >
                <h2 className="text-lg font-medium text-foreground">
                  {ex.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {ex.default_sets} sets × {ex.default_reps} reps
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Position: {ex.position}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
