import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalExerciseName, exerciseKey } from "./exercises";
import { toKg, type Units } from "./units";

/** Editor state. Weight/reps are the raw input strings, in the user's unit. */
export interface WorkoutSet {
  key: string;
  weight: string;
  reps: string;
  done: boolean;
}

export interface WorkoutExercise {
  key: string;
  name: string;
  muscle_group: string | null;
  sets: WorkoutSet[];
}

export const newKey = () => Math.random().toString(36).slice(2, 10);

export function emptySet(weight = "", reps = ""): WorkoutSet {
  return { key: newKey(), weight, reps, done: false };
}

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Exercises with at least one filled-in set, converted to kg. Empty sets are dropped.
 * `units` is the unit the weights were typed in: one for all, or per exercise name.
 */
export function cleanWorkout(
  exercises: WorkoutExercise[],
  units: Units | ((name: string) => Units),
  knownNames: string[] = []
) {
  return exercises
    .filter((ex) => ex.name.trim())
    .map((ex) => ({
      name: canonicalExerciseName(ex.name, knownNames),
      muscle_group: ex.muscle_group,
      sets: ex.sets
        .map((s) => ({
          weight: toKg(num(s.weight), typeof units === "function" ? units(ex.name) : units),
          reps: num(s.reps),
        }))
        .filter((s) => s.weight !== null || s.reps !== null),
    }))
    .filter((ex) => ex.sets.length > 0);
}

export type CleanExercise = ReturnType<typeof cleanWorkout>[number];

/**
 * The user's log (workout or rest day) on a PH calendar date, if any.
 * Compares only the stored YYYY-MM-DD log date, never timestamps.
 */
export async function findLogOnDate(supabase: SupabaseClient, userId: string, logDate: string) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("id, is_rest_day")
    .eq("user_id", userId)
    .eq("date", logDate)
    .limit(1);
  if (error) throw error;
  return (data?.[0] as { id: string; is_rest_day: boolean } | undefined) ?? null;
}

/**
 * Save a workout's session, exercises and sets all-or-nothing via the
 * save_workout database function (supabase/features.sql). `sessionId` null logs
 * a new workout; otherwise that workout's date, exercises and sets are replaced.
 * Falls back to step-by-step writes if the function isn't installed yet.
 */
export async function saveWorkout(
  supabase: SupabaseClient,
  opts: { sessionId: string | null; routineId: string | null; date: string; exercises: CleanExercise[] }
): Promise<string> {
  const { data, error } = await supabase.rpc("save_workout", {
    p_session_id: opts.sessionId,
    p_routine_id: opts.routineId,
    p_date: opts.date,
    p_exercises: opts.exercises,
  });
  if (!error) return data as string;
  if (error.code !== "PGRST202") throw error; // PGRST202: function not installed

  if (opts.sessionId) {
    const { error: dateErr } = await supabase
      .from("workout_sessions")
      .update({ date: opts.date })
      .eq("id", opts.sessionId);
    if (dateErr) throw dateErr;
    await clearSessionExercises(supabase, opts.sessionId);
    await insertSessionExercises(supabase, opts.sessionId, opts.exercises);
    return opts.sessionId;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: session, error: sessErr } = await supabase
    .from("workout_sessions")
    .insert({ user_id: user.id, routine_id: opts.routineId, date: opts.date, is_rest_day: false })
    .select("id")
    .single();
  if (sessErr) throw sessErr;
  const sessionId = session.id as string;
  try {
    await insertSessionExercises(supabase, sessionId, opts.exercises);
  } catch (err) {
    // Don't leave a half-saved empty session behind
    await supabase.from("workout_sessions").delete().eq("id", sessionId);
    throw err;
  }
  return sessionId;
}

/** Insert exercises + sets for a session. */
export async function insertSessionExercises(
  supabase: SupabaseClient,
  sessionId: string,
  exercises: CleanExercise[]
) {
  if (!exercises.length) return;
  const { data: inserted, error } = await supabase
    .from("session_exercises")
    .insert(
      exercises.map((ex, i) => ({
        session_id: sessionId,
        name: ex.name,
        muscle_group: ex.muscle_group,
        position: i + 1,
      }))
    )
    .select("id, position");
  if (error) throw error;

  const idByPosition = new Map((inserted ?? []).map((r) => [r.position as number, r.id as string]));
  const sets = exercises.flatMap((ex, i) =>
    ex.sets.map((s, j) => ({
      session_exercise_id: idByPosition.get(i + 1)!,
      set_number: j + 1,
      weight: s.weight,
      reps: s.reps,
    }))
  );
  if (sets.length) {
    const { error: setErr } = await supabase.from("sets").insert(sets);
    if (setErr) throw setErr;
  }
}

/** Remove all exercises + sets of a session (explicitly, so it works even without cascades). */
export async function clearSessionExercises(supabase: SupabaseClient, sessionId: string) {
  const { data: exs, error } = await supabase
    .from("session_exercises")
    .select("id")
    .eq("session_id", sessionId);
  if (error) throw error;
  const ids = (exs ?? []).map((e) => e.id);
  if (!ids.length) return;
  const { error: setErr } = await supabase.from("sets").delete().in("session_exercise_id", ids);
  if (setErr) throw setErr;
  const { error: exErr } = await supabase.from("session_exercises").delete().in("id", ids);
  if (exErr) throw exErr;
}

/** New personal bests (by top weight) compared to prior bests in kg, keyed by exerciseKey. */
export function findPRs(exercises: CleanExercise[], priorBest: Record<string, number | null>) {
  const prs: { name: string; weight: number; previous: number }[] = [];
  for (const ex of exercises) {
    const top = Math.max(...ex.sets.map((s) => s.weight ?? 0));
    const prev = priorBest[exerciseKey(ex.name)];
    if (top > 0 && prev !== null && prev !== undefined && top > prev) {
      prs.push({ name: ex.name, weight: top, previous: prev });
    }
  }
  return prs;
}
