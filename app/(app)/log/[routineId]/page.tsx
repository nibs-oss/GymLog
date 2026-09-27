import Link from "next/link";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getUserSettings } from "@/lib/settings";
import { fetchLoggedSets, summariseByExercise, type ExerciseSummary } from "@/lib/history";
import LogSessionClient from "./LogSessionClient";

/** Routine, its exercises, the user's settings, and what they did last time */
async function fetchRoutineData(routineId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: routine } = await supabase
    .from("routines")
    .select("id, name")
    .eq("id", routineId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!routine) return null;

  const [{ data: exercises }, settings, rows] = await Promise.all([
    supabase
      .from("routine_exercises")
      .select("id, name, position, default_sets, default_reps, muscle_group")
      .eq("routine_id", routine.id)
      .order("position", { ascending: true }),
    getUserSettings(supabase, user.id),
    fetchLoggedSets(supabase, user.id),
  ]);

  // Plain object so it can cross to the client component
  const history: Record<string, ExerciseSummary> = Object.fromEntries(summariseByExercise(rows));

  return { routine, exercises: exercises ?? [], settings, history };
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
      <section className="flex min-h-[60vh] items-center justify-center px-4 py-8">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Routine not found</h1>
          <p className="mt-4 text-slate-400">You may not have access to this routine.</p>
          <Link
            href="/log"
            className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-accent/90"
          >
            Back to Log
          </Link>
        </div>
      </section>
    );
  }

  return (
    <LogSessionClient
      routine={data.routine}
      exercises={data.exercises}
      units={data.settings.units}
      weeklyGoal={data.settings.weekly_goal}
      history={data.history}
    />
  );
}
