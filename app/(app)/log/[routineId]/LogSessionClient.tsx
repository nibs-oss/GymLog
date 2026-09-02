"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/utils/supabase/client";

interface Routine {
  id: string;
  name: string;
}

interface RoutineExercise {
  id: string;
  name: string;
  position: number;
  default_sets: number;
  default_reps: number;
  last_weight?: number | null;
}

interface SessionExercise {
  id?: string; // Supabase id after insert
  name: string;
  position: number;
  sets: SetInput[];
}

interface SetInput {
  set_number: number;
  weight: number | null;
  reps: number | null;
}

export default function LogSessionClient({
  routine,
  exercises,
}: {
  routine: Routine;
  exercises: RoutineExercise[];
}) {
  const router = useRouter();
  const supabase = createBrowserClient();

  // Build initial state from routine exercises
  const initialSessionExercises: SessionExercise[] = exercises.map((ex) => ({
    name: ex.name,
    position: ex.position,
    sets: Array.from({ length: ex.default_sets }).map((_, sIdx) => ({
      set_number: sIdx + 1,
      weight: ex.last_weight ?? null,
      reps: ex.default_reps ?? null,
    } as SetInput)),
  }));

  const [sessionExercises, setSessionExercises] = useState(initialSessionExercises);
  const [extraExercises, setExtraExercises] = useState<SessionExercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------
  // Handlers for dynamic sets and exercises
  // ---------------------------------------------------------------
  const updateSet = (
    exIdx: number,
    setIdx: number,
    field: keyof SetInput,
    value: any
  ) => {
    setSessionExercises((prev) => {
      const copy = [...prev];
      const setsCopy = [...copy[exIdx].sets];
      const parsed = value === "" ? null : Number(value);
      // @ts-ignore dynamic assignment
      setsCopy[setIdx][field] = parsed;
      copy[exIdx] = { ...copy[exIdx], sets: setsCopy };
      return copy;
    });
  };

  const addSet = (exIdx: number) => {
    setSessionExercises((prev) => {
      const copy = [...prev];
      const cur = copy[exIdx];
      const newSetNumber = cur.sets.length + 1;
      copy[exIdx] = {
        ...cur,
        sets: [...cur.sets, { set_number: newSetNumber, weight: null, reps: null } as SetInput],
      };
      return copy;
    });
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setSessionExercises((prev) => {
      const copy = [...prev];
      const cur = copy[exIdx];
      const newSets = cur.sets
        .filter((_, i) => i !== setIdx)
        .map((s, i) => ({ ...s, set_number: i + 1 }));
      copy[exIdx] = { ...cur, sets: newSets };
      return copy;
    });
  };

  const addExtraExercise = () => {
    setExtraExercises((prev) => [
      ...prev,
      {
        name: "",
        position: exercises.length + prev.length + 1,
        sets: [{ set_number: 1, weight: null, reps: null } as SetInput],
      },
    ]);
  };

  const updateExtraExercise = (
    idx: number,
    field: keyof SessionExercise,
    value: any
  ) => {
    setExtraExercises((prev) => {
      const copy = [...prev];
      // @ts-ignore dynamic assignment
      copy[idx][field] = value;
      return copy;
    });
  };

  const updateExtraSet = (
    exIdx: number,
    setIdx: number,
    field: keyof SetInput,
    value: any
  ) => {
    setExtraExercises((prev) => {
      const copy = [...prev];
      const setsCopy = [...copy[exIdx].sets];
      const parsed = value === "" ? null : Number(value);
      // @ts-ignore dynamic assignment
      setsCopy[setIdx][field] = parsed;
      copy[exIdx] = { ...copy[exIdx], sets: setsCopy };
      return copy;
    });
  };

  // ---------------------------------------------------------------
  // Finish Workout – insert session, exercises, and sets
  // ---------------------------------------------------------------
  const finishWorkout = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const today = new Date().toISOString().split('T')[0];
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
      const sessionId = sessionData.id;

      const allExercises = [...sessionExercises, ...extraExercises];
      const insertedExercises: { id: string }[] = [];
      for (let i = 0; i < allExercises.length; i++) {
        const ex = allExercises[i];
        const { data: exData, error: exErr } = await supabase
          .from("session_exercises")
          .insert({
            session_id: sessionId,
            name: ex.name,
            position: i + 1,
          })
          .select("id")
          .single();
        if (exErr) throw exErr;
        insertedExercises.push({ id: exData.id });
      }

      for (let i = 0; i < allExercises.length; i++) {
        const ex = allExercises[i];
        const exerciseId = insertedExercises[i].id;
        const setsPayload = ex.sets.map((s) => ({
          session_exercise_id: exerciseId,
          set_number: s.set_number,
          weight: s.weight,
          reps: s.reps,
        }));
        const { error: setErr } = await supabase.from("sets").insert(setsPayload);
        if (setErr) throw setErr;
      }

      router.refresh();
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to save workout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">Log Workout: {routine.name}</h1>

      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Routine exercises */}
      {sessionExercises.map((ex, exIdx) => (
        <div key={exIdx} className="space-y-2 rounded-lg border border-white/10 bg-zinc-900/60 p-4">
          <h2 className="text-lg font-medium text-foreground">{ex.name}</h2>
          {ex.sets.map((set, setIdx) => (
            <div key={setIdx} className="flex flex-wrap gap-2 items-center">
              <span className="w-8 text-sm text-zinc-400">Set {set.set_number}</span>
              <input
                type="number"
                min={0}
                placeholder="Weight"
                value={set.weight ?? ""}
                onChange={(e) => updateSet(exIdx, setIdx, "weight", e.target.value)}
                className="w-20 rounded border border-white/10 bg-zinc-950 px-2 py-1 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent"
              />
              <input
                type="number"
                min={0}
                placeholder="Reps"
                value={set.reps ?? ""}
                onChange={(e) => updateSet(exIdx, setIdx, "reps", e.target.value)}
                className="w-20 rounded border border-white/10 bg-zinc-950 px-2 py-1 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent"
              />
              {ex.sets.length > 1 && (
                <button type="button" onClick={() => removeSet(exIdx, setIdx)} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => addSet(exIdx)} className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-black hover:bg-accent/90">
            + Add Set
          </button>
        </div>
      ))}

      {/* Extra exercises */}
      {extraExercises.map((ex, exIdx) => (
        <div key={exIdx} className="space-y-2 rounded-lg border border-white/10 bg-zinc-900/60 p-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-300">Exercise Name</span>
            <input
              type="text"
              value={ex.name}
              onChange={(e) => updateExtraExercise(exIdx, "name", e.target.value)}
              className="mt-1 block w-full rounded border border-white/10 bg-zinc-950 px-2 py-1 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent"
            />
          </label>
          {ex.sets.map((set, setIdx) => (
            <div key={setIdx} className="flex flex-wrap gap-2 items-center mt-2">
              <span className="w-8 text-sm text-zinc-400">Set {set.set_number}</span>
              <input
                type="number"
                min={0}
                placeholder="Weight"
                value={set.weight ?? ""}
                onChange={(e) => updateExtraSet(exIdx, setIdx, "weight", e.target.value)}
                className="w-20 rounded border border-white/10 bg-zinc-950 px-2 py-1 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent"
              />
              <input
                type="number"
                min={0}
                placeholder="Reps"
                value={set.reps ?? ""}
                onChange={(e) => updateExtraSet(exIdx, setIdx, "reps", e.target.value)}
                className="w-20 rounded border border-white/10 bg-zinc-950 px-2 py-1 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent"
              />
              {ex.sets.length > 1 && (
                <button type="button" onClick={() => {
                  const newSets = ex.sets.filter((_, i) => i !== setIdx).map((s, i) => ({ ...s, set_number: i + 1 }));
                  updateExtraExercise(exIdx, "sets", newSets);
                }} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => {
            const newSetNum = ex.sets.length + 1;
            const newSets = [...ex.sets, { set_number: newSetNum, weight: null, reps: null } as SetInput];
            updateExtraExercise(exIdx, "sets", newSets);
          }} className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-black hover:bg-accent/90">
            + Add Set
          </button>
        </div>
      ))}

      <button type="button" onClick={addExtraExercise} className="mt-4 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent/90">
        + Add Extra Exercise
      </button>

      <button type="button" onClick={finishWorkout} disabled={loading} className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-black hover:bg-accent/90 disabled:opacity-60">
        {loading ? "Saving…" : "Finish Workout"}
      </button>
    </section>
  );
}
