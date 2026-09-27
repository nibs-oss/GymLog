"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { canonicalExerciseName } from "@/lib/exercises";
import { useKnownExercises } from "@/lib/use-known-exercises";
import {
  RoutineExerciseEditor,
  newEditableExercise,
  type EditableExercise,
} from "@/components/routine-exercise-editor";
import { errorMessage } from "@/lib/errors";

export default function NewRoutinePage() {
  const router = useRouter();
  const knownNames = useKnownExercises();

  const [name, setName] = useState("");
  const [exercises, setExercises] = useState<EditableExercise[]>(() => [newEditableExercise()]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Routine name cannot be empty.");
      return;
    }
    if (exercises.length === 0) {
      setError("Add at least one exercise.");
      return;
    }
    if (exercises.some((ex) => !ex.name.trim())) {
      setError("Exercise names cannot be empty.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: routineData, error: routineError } = await supabase
        .from("routines")
        .insert({ name: name.trim(), user_id: user.id })
        .select("id")
        .single();
      if (routineError) throw routineError;

      const { error: exercisesError } = await supabase.from("routine_exercises").insert(
        exercises.map((ex, idx) => ({
          routine_id: routineData.id,
          name: canonicalExerciseName(ex.name, knownNames),
          muscle_group: ex.muscle_group,
          position: idx + 1,
          default_sets: ex.default_sets,
          default_reps: ex.default_reps,
        }))
      );
      if (exercisesError) throw exercisesError;

      router.push(`/routines/${routineData.id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "An error occurred"));
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/routines"
        className="inline-block rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-foreground"
      >
        ← Back to Routines
      </Link>
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6"
      >
        <h1 className="text-2xl font-semibold text-foreground">Create Routine</h1>
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
            className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-foreground placeholder:text-slate-600"
            placeholder="e.g. Upper Body Strength"
          />
        </label>

        <div className="space-y-3">
          <h2 className="text-lg font-medium text-foreground">Exercises</h2>
          <RoutineExerciseEditor items={exercises} onChange={setExercises} knownNames={knownNames} />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-accent/90 disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create Routine"}
        </button>
      </form>
    </section>
  );
}
