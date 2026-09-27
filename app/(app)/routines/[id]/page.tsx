import { createClient as createServerClient } from "@/utils/supabase/server";
import Link from "next/link";
import RoutineDetailClient from "./RoutineDetailClient";

// Types for data returned from Supabase
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

/** Fetch routine and its exercises, ensuring the routine belongs to the logged‑in user */
async function fetchRoutine(id: string): Promise<{
  routine: Routine;
  exercises: Exercise[];
} | null> {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware already guards, but safety first

  const { data: routine, error: routineError } = await supabase
    .from("routines")
    .select("id, name, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (routineError || !routine) return null;

  const { data: exercises, error: exError } = await supabase
    .from("routine_exercises")
    .select("id, name, position, default_sets, default_reps, muscle_group")
    .eq("routine_id", routine.id)
    .order("position", { ascending: true });

  if (exError) return null;

  return { routine, exercises: exercises ?? [] };
}

export default async function RoutineDetailPage({
  // In Next.js 15+ the params can be a Promise
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Resolve the async params
  const { id } = await params;

  const data = await fetchRoutine(id);

  if (!data) {
    // Render a simple not‑found UI (server‑side only)
    return (
      <section className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="rounded-lg border border-white/10 bg-slate-900/60 p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Routine not found</h1>
          <p className="mt-4 text-slate-400">
            The routine either does not exist or you don&#39;t have access to it.
          </p>
          <Link
            href="/routines"
            className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-accent/90"
          >
            Back to Routines
          </Link>
        </div>
      </section>
    );
  }

  // Pass data to the client component for interactive UI
  return <RoutineDetailClient routine={data.routine} exercises={data.exercises} />;
}
