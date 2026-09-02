import { createClient as createServerClient } from "@/utils/supabase/server";
import Link from "next/link";

interface ExerciseStat {
  name: string;
  pb: number | null; // personal best weight
  count: number; // number of sessions logged
}

/** Fetch distinct exercises for the user with PB */
async function fetchExerciseStats() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch session_exercises for this user (join via workout_sessions)
  const { data: sesEx } = await supabase
    .from("session_exercises")
    .select("id, name, workout_sessions!inner(user_id)")
    .eq("workout_sessions.user_id", user.id);

  if (!sesEx || sesEx.length === 0) return [];

  // Group by exercise name and collect session_exercise ids
  const groups: Record<string, { ids: string[]; count: number }> = {};
  for (const row of sesEx as any[]) {
    const name: string = row.name;
    if (!groups[name]) {
      groups[name] = { ids: [], count: 0 };
    }
    groups[name].ids.push(row.id);
    groups[name].count++;
  }

  // Fetch all sets for the collected session_exercise ids
  const allIds = Object.values(groups).flatMap((g) => g.ids);
  const { data: setRows } = await supabase
    .from("sets")
    .select("weight, session_exercise_id")
    .in("session_exercise_id", allIds);

  // Compute PB per exercise name
  const stats: ExerciseStat[] = [];
  for (const [name, { ids, count }] of Object.entries(groups)) {
    const weights = setRows
      ?.filter((s: any) => ids.includes(s.session_exercise_id))
      .map((s: any) => s.weight)
      .filter((w: any) => w !== null && w !== undefined) as number[];
    const pb = weights && weights.length > 0 ? Math.max(...weights) : null;
    stats.push({ name, pb, count });
  }

  // Sort by PB descending (nulls last)
  stats.sort((a, b) => (b.pb ?? 0) - (a.pb ?? 0));
  return stats;
}

export default async function ProgressPage() {
  const stats = await fetchExerciseStats();
  const hasData = stats.length > 0;

  return (
    <section className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
      {hasData ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stats.map((ex) => (
            <Link
              key={ex.name}
              href={`/progress/${encodeURIComponent(ex.name)}`}
              className="group block rounded-lg border border-white/10 bg-zinc-900/60 p-4 transition-colors hover:border-accent hover:bg-zinc-800/80"
            >
              <h2 className="text-lg font-medium text-foreground group-hover:text-accent">
                {ex.name}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">PB: {ex.pb ?? "N/A"} kg</p>
              <p className="mt-1 text-sm text-zinc-400">Logged in {ex.count} sessions</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-8 text-center">
          <p className="text-zinc-400">No exercises logged yet. Start by logging a workout.</p>
          <Link
            href="/log"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent/90"
          >
            Log Workout
          </Link>
        </div>
      )}
    </section>
  );
}
