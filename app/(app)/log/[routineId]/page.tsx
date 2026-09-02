import { createClient as createServerClient } from "@/utils/supabase/server";
import LogSessionClient from "./LogSessionClient";

interface RoutineExercise {
  id: string;
  name: string;
  position: number;
  default_sets: number;
  default_reps: number;
  last_weight?: number | null;
}

/** Fetch routine, its exercises, and last used weight for each exercise */
async function fetchRoutineData(routineId: string) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Verify routine belongs to user
  const { data: routine, error: routineErr } = await supabase
    .from("routines")
    .select("id, name")
    .eq("id", routineId)
    .eq("user_id", user.id)
    .single();
  if (routineErr || !routine) return null;

  // Get exercises for this routine
  const { data: exercises, error: exErr } = await supabase
    .from("routine_exercises")
    .select("id, name, position, default_sets, default_reps")
    .eq("routine_id", routine.id)
    .order("position", { ascending: true });
  if (exErr) return null;

  // For each exercise, fetch most recent weight logged by this user
  const enriched = await Promise.all(
    (exercises ?? []).map<Promise<RoutineExercise>>(async (ex) => {
      // Find most recent session_exercise with same name for this user
      const { data: recentSesEx } = await supabase
        .from("session_exercises")
        .select("id, workout_sessions!inner(date)")
        .eq("name", ex.name)
        .eq("workout_sessions.user_id", user.id)
        .order("workout_sessions.date", { ascending: false })
        .limit(1)
        .single();

      let lastWeight: number | null = null;
      if (recentSesEx) {
        const { data: recentSet } = await supabase
          .from("sets")
          .select("weight")
          .eq("session_exercise_id", recentSesEx.id)
          .order("set_number", { ascending: false })
          .limit(1)
          .single();
        if (recentSet) lastWeight = recentSet.weight ?? null;
      }

      return {
        ...ex,
        last_weight: lastWeight,
      } as RoutineExercise;
    })
  );

  return { routine, exercises: enriched };
}

export default async function LogRoutinePage({
  params,
}: {
  params: Promise<{ routineId: string }>;
}) {
  const { routineId } = await params;
  const data = await fetchRoutineData(routineId);

  if (!data) {
    return (
      <section className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Routine not found</h1>
          <p className="mt-4 text-zinc-400">You may not have access to this routine.</p>
          <a
            href="/log"
            className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent/90"
          >
            Back to Log
          </a>
        </div>
      </section>
    );
  }

  return <LogSessionClient routine={data.routine} exercises={data.exercises} />;
}
