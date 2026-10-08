import Link from "next/link";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getUserSettings } from "@/lib/settings";
import { fetchLoggedSets, summariseByExercise } from "@/lib/history";
import SessionEditor from "./SessionEditor";

interface ExerciseRow {
  name: string;
  muscle_group: string | null;
  sets: { set_number: number; weight: number | string | null; reps: number | string | null }[] | null;
}

async function fetchSession(sessionId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id, date, is_rest_day, routine_id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!session) return null;

  const [{ data: routine }, { data: exercises }, settings, rows] = await Promise.all([
    session.routine_id
      ? supabase.from("routines").select("name").eq("id", session.routine_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("session_exercises")
      .select("id, name, muscle_group, position, sets(set_number, weight, reps)")
      .eq("session_id", session.id)
      .order("position", { ascending: true }),
    getUserSettings(supabase, user.id),
    fetchLoggedSets(supabase, user.id),
  ]);

  const knownNames = [...summariseByExercise(rows).values()].map((s) => s.name);

  return {
    session,
    routineName: (routine as { name: string } | null)?.name ?? null,
    exercises: ((exercises ?? []) as ExerciseRow[]).map((ex) => ({
      name: ex.name,
      muscle_group: ex.muscle_group ?? null,
      sets: [...(ex.sets ?? [])]
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
          weight: s.weight === null ? null : Number(s.weight),
          reps: s.reps === null ? null : Number(s.reps),
        })),
    })),
    units: settings.units,
    exerciseUnits: settings.exercise_units,
    knownNames,
  };
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const data = await fetchSession(sessionId);

  if (!data) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center">
          <h1 className="text-xl font-semibold">Workout not found</h1>
          <Link
            href="/history"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-accent/90"
          >
            Back to History
          </Link>
        </div>
      </section>
    );
  }

  return <SessionEditor {...data} />;
}
