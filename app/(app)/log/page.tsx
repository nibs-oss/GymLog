import { createClient as createServerClient } from "@/utils/supabase/server";
import Link from "next/link";

/** Server component that lists routines for logging a workout */
async function fetchRoutines() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { routines: [], hasLoggedToday: false };

  // Check if a session already exists for today (date stored as DATE string)
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", today)
    .single();

  const { data: routines } = await supabase
    .from("routines")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return { routines: routines ?? [], hasLoggedToday: !!existing };
}

export default async function LogHomePage() {
  const { routines, hasLoggedToday } = await fetchRoutines();

  return (
    <section className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">Log Workout</h1>

      {hasLoggedToday ? (
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-4 text-center">
          <p className="text-zinc-400">You have already logged a workout for today.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {routines.map((r) => (
              <Link
                key={r.id}
                href={`/log/${r.id}`}
                className="group block rounded-lg border border-white/10 bg-zinc-900/60 p-4 transition-colors hover:border-accent hover:bg-zinc-800/80"
              >
                <h2 className="text-lg font-medium text-foreground group-hover:text-accent">
                  {r.name}
                </h2>
              </Link>
            ))}
          </div>
          <Link
            href="/log/rest"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent/90"
          >
            Log Rest Day
          </Link>
        </>
      )}
    </section>
  );
}
