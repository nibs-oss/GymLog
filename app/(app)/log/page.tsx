import { createClient as createServerClient } from "@/utils/supabase/server";
import Link from "next/link";
import { localIsoDate } from "@/lib/fitness";

interface RoutineRow {
  id: string;
  name: string;
  routine_exercises: { count: number }[] | null;
}

/** Routines to pick from, plus whether something is already logged today */
async function fetchRoutines() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { routines: [], todaySession: null };

  const [{ data: todays }, { data: routines }, { data: recent }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, is_rest_day")
      .eq("user_id", user.id)
      .eq("date", localIsoDate())
      .limit(1),
    supabase
      .from("routines")
      .select("id, name, routine_exercises(count)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("workout_sessions")
      .select("routine_id, date")
      .eq("user_id", user.id)
      .not("routine_id", "is", null)
      .order("date", { ascending: false })
      .limit(200),
  ]);

  const lastDone = new Map<string, string>();
  for (const s of recent ?? []) {
    if (s.routine_id && !lastDone.has(s.routine_id)) lastDone.set(s.routine_id, s.date);
  }

  return {
    todaySession: todays?.[0] ?? null,
    routines: ((routines ?? []) as RoutineRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      exerciseCount: r.routine_exercises?.[0]?.count ?? 0,
      lastDone: lastDone.get(r.id) ?? null,
    })),
  };
}

export default async function LogHomePage() {
  const { routines, todaySession } = await fetchRoutines();

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Log Workout</h1>

      {todaySession ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-center">
          <p className="text-slate-300">
            You already logged {todaySession.is_rest_day ? "a rest day" : "a workout"} today. 💪
          </p>
          <Link
            href={`/history/${todaySession.id}`}
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-accent/90"
          >
            View or edit today&apos;s entry
          </Link>
        </div>
      ) : (
        <>
          {routines.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center">
              <p className="text-slate-400">Create a routine first, then log it here.</p>
              <Link
                href="/routines/new"
                className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-accent/90"
              >
                Create Routine
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {routines.map((r) => (
                <Link
                  key={r.id}
                  href={`/log/${r.id}`}
                  className="group block rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition-colors hover:border-accent hover:bg-slate-800/80"
                >
                  <h2 className="text-lg font-medium text-foreground group-hover:text-accent">{r.name}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {r.exerciseCount} {r.exerciseCount === 1 ? "exercise" : "exercises"}
                    {r.lastDone ? ` · last done ${r.lastDone}` : " · not done yet"}
                  </p>
                </Link>
              ))}
            </div>
          )}
          <Link
            href="/log/rest"
            className="inline-block rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-white/5"
          >
            😴 Log Rest Day
          </Link>
        </>
      )}
    </section>
  );
}
