"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function NewRoutinePage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [exercises, setExercises] = useState([
    { name: "", default_sets: 3, default_reps: 10 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExerciseChange = (index: number, field: string, value: any) => {
    setExercises((prev) => {
      const copy = [...prev];
      // @ts-ignore dynamic assignment
      copy[index][field] = value;
      return copy;
    });
  };

  const addExercise = () => {
    setExercises((prev) => [...prev, { name: "", default_sets: 3, default_reps: 10 }]);
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert routine
      const { data: routineData, error: routineError } = await supabase
        .from("routines")
        .insert({ name: name.trim(), user_id: user.id })
        .select("id")
        .single();
      if (routineError) throw routineError;
      const routineId = routineData.id;

      // Insert exercises with proper position
      const exercisesToInsert = exercises.map((ex, idx) => ({
        routine_id: routineId,
        name: ex.name.trim(),
        position: idx + 1,
        default_sets: ex.default_sets,
        default_reps: ex.default_reps,
      }));

      const { error: exercisesError } = await supabase
        .from("routine_exercises")
        .insert(exercisesToInsert);
      if (exercisesError) throw exercisesError;

      router.push("/routines");
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl rounded-lg border border-white/10 bg-zinc-900/60 p-8"
      >
        <h1 className="mb-6 text-2xl font-semibold text-foreground">Create Routine</h1>
        {error && (
          <p className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400">
            {error}
          </p>
        )}
        <label className="mb-4 block">
          <span className="block text-sm font-medium text-zinc-300">Routine Name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent"
            placeholder="e.g. Upper Body Strength"
          />
        </label>

        <div className="space-y-6">
          <h2 className="text-lg font-medium text-foreground">Exercises</h2>
          {exercises.map((ex, idx) => (
            <div
              key={idx}
              className="grid gap-2 rounded-lg border border-white/10 bg-zinc-800/30 p-4 sm:grid-cols-4"
            >
              <input
                type="text"
                required
                value={ex.name}
                onChange={(e) => handleExerciseChange(idx, "name", e.target.value)}
                placeholder="Exercise name"
                className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent"
              />
              <input
                type="number"
                min={1}
                required
                value={ex.default_sets}
                onChange={(e) => handleExerciseChange(idx, "default_sets", Number(e.target.value))}
                className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent"
                placeholder="Sets"
              />
              <input
                type="number"
                min={1}
                required
                value={ex.default_reps}
                onChange={(e) => handleExerciseChange(idx, "default_reps", Number(e.target.value))}
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
            className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-black hover:bg-accent/90"
          >
            + Add Exercise
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-black hover:bg-accent/90 disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create Routine"}
        </button>
      </form>
    </main>
  );
}
