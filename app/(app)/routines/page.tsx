import { createClient as createServerClient } from "@/utils/supabase/server";
import Link from "next/link";

/** Server component that fetches routines for the logged‑in user */
async function fetchRoutines() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Not authenticated – the middleware already redirects, but we guard anyway
    return [];
  }

  // Fetch routines belonging to this user, newest first
  const { data: routines, error } = await supabase
    .from("routines")
    .select("id, name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching routines:", error);
    return [];
  }

  // For each routine, fetch the number of associated exercises
  const routinesWithCount = await Promise.all(
    (routines ?? []).map(async (routine) => {
      const { count } = await supabase
        .from("routine_exercises")
        .select("id", { count: "exact", head: true })
        .eq("routine_id", routine.id);
      return { ...routine, exerciseCount: count ?? 0 } as typeof routine & { exerciseCount: number };
    })
  );

  return routinesWithCount;
}

function RoutineCard({ routine }: { routine: { id: string; name: string; created_at: string; exerciseCount: number } }) {
  return (
    <Link
      href={`/routines/${routine.id}`}
      className="group block rounded-lg border border-white/10 bg-slate-900/60 p-4 transition-colors hover:border-accent hover:bg-slate-800/80"
    >
      <h2 className="text-lg font-medium text-foreground group-hover:text-accent">
        {routine.name}
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        {routine.exerciseCount} {routine.exerciseCount === 1 ? "exercise" : "exercises"}
      </p>
    </Link>
  );
}

export default async function RoutinesPage() {
  const routines = await fetchRoutines();

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Routines</h1>
        <Link
          href="/routines/new"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-accent/90"
        >
          Create Routine
        </Link>
      </div>

      {routines.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-slate-900/60 p-8 text-center">
          <p className="text-slate-400">You don’t have any routines yet.</p>
          <Link
            href="/routines/new"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-accent/90"
          >
            Create your first routine
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {routines.map((routine) => (
            <RoutineCard key={routine.id} routine={routine} />
          ))}
        </div>
      )}
    </section>
  );
}
