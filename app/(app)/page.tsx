export const dynamic = 'force-dynamic';

import { createClient as createServerClient } from "@/utils/supabase/server";
import Link from "next/link";

interface Session {
  id: string;
  routine_id: string | null;
  date: string; // ISO date string (YYYY-MM-DD)
  is_rest_day: boolean;
}

interface Routine {
  id: string;
  name: string;
}

/** Helper to compute relative date string */
function relativeDate(dateStr: string): string {
  const today = new Date();
  const target = new Date(dateStr);
  // Zero out time for day comparison
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff} days ago`;
}

/** Fetch all needed data for the dashboard */
async function fetchDashboardData() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, routine_id, date, is_rest_day, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("date", { ascending: false });

  const allSessions = sessions ?? [];

  const gymDays = new Set<string>();
  allSessions.forEach((s) => {
    if (!s.is_rest_day) gymDays.add(s.date);
  });

  const sortedGymDays = Array.from(gymDays).sort((a, b) => (a < b ? 1 : -1));
  let streak = 0;
  let prevDate: Date | null = null;
  for (const dateStr of sortedGymDays) {
    const current = new Date(dateStr);
    current.setHours(0, 0, 0, 0);
    if (streak === 0) {
      streak = 1;
      prevDate = current;
      continue;
    }
    const diffDays = Math.round((prevDate!.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak++;
      prevDate = current;
    } else {
      break;
    }
  }

  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date();
  weekStart.setDate(today.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartIso = weekStart.toISOString().split("T")[0];

  const weekGymDays = new Set(
    allSessions
      .filter(
        (s) => !s.is_rest_day && s.date >= weekStartIso && s.date <= today.toISOString().split("T")[0]
      )
      .map((s) => s.date)
  ).size;

  const lastWorkout = allSessions.find((s) => !s.is_rest_day) ?? null;
  const recent = allSessions.slice(0, 5);

  async function fetchRoutineName(routineId: string | null): Promise<string | null> {
    if (!routineId) return null;
    const { data: routine } = await supabase
      .from("routines")
      .select("name")
      .eq("id", routineId)
      .single();
    return routine?.name ?? null;
  }

  async function countExercises(sessionId: string): Promise<number> {
    const { count } = await supabase
      .from("session_exercises")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    return count ?? 0;
  }

  const [lastWorkoutDetails, recentDetails] = await Promise.all([
    (async () => {
      if (!lastWorkout) return null;
      const [routineName, exCount] = await Promise.all([
        fetchRoutineName(lastWorkout.routine_id),
        countExercises(lastWorkout.id),
      ]);
      return { session: lastWorkout, routineName, exCount };
    })(),
    (async () => {
      return Promise.all(
        recent.map(async (s) => {
          const [routineName, exCount] = await Promise.all([
            fetchRoutineName(s.routine_id),
            countExercises(s.id),
          ]);
          return { session: s, routineName, exCount };
        })
      );
    })(),
  ]);

  return { streak, weekGymDays, lastWorkout: lastWorkoutDetails, recentActivities: recentDetails };
}

export default async function HomePage() {
  const data = await fetchDashboardData();

  if (!data) {
    return (
      <section className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Please log in</h1>
        </div>
      </section>
    );
  }

  const { streak, weekGymDays, lastWorkout, recentActivities } = data;
  const hasAnySession = recentActivities.length > 0;

  return (
    <section className="space-y-8 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <Link
          href="/log"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent/90"
        >
          Log Workout
        </Link>
      </div>

      {hasAnySession ? (
        <>
          {/* Streak */}
          <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-6 text-center">
            <p className="text-3xl font-bold text-accent">🔥 {streak} Day Streak</p>
          </div>

          {/* Stats grid for mobile */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Week stats */}
            <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-4 text-center">
              <p className="text-sm text-zinc-400">Gym days this week</p>
              <p className="text-2xl font-semibold text-foreground">{weekGymDays}</p>
            </div>
            {/* Last workout */}
            {lastWorkout && (
              <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-4">
                <h2 className="text-lg font-medium text-foreground">Last Workout</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {lastWorkout.routineName ?? "Unknown Routine"} &middot; {relativeDate(lastWorkout.session.date)}
                </p>
                <p className="mt-1 text-sm text-zinc-400">{lastWorkout.exCount} {lastWorkout.exCount === 1 ? "exercise" : "exercises"}</p>
              </div>
            )}
            {/* Placeholder to keep grid balanced on small screens */}
            <div className="hidden lg:block"></div>
          </div>

          {/* Recent activity feed */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-foreground">Recent Activity</h2>
            {recentActivities.map(({ session, routineName, exCount }) => (
              <div
                key={session.id}
                className="rounded-lg border border-white/10 bg-zinc-900/60 p-3"
              >
                <p className="text-sm text-zinc-400">{relativeDate(session.date)}</p>
                <p className="font-medium text-foreground">
                  {session.is_rest_day ? "Rest Day" : routineName ?? "Unknown Routine"}
                </p>
                {!session.is_rest_day && (
                  <p className="text-sm text-zinc-400">{exCount} {exCount === 1 ? "exercise" : "exercises"}</p>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-8 text-center">
          <h2 className="text-2xl font-semibold text-foreground">Welcome to GymLog!</h2>
          <p className="mt-4 text-zinc-400">It looks like you haven\'t logged any workouts yet.</p>
          <Link
            href="/log"
            className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent/90"
          >
            Log your first workout
          </Link>
        </div>
      )}
    </section>
  );
}
