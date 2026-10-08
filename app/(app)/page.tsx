export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { computeStreak, daysBetweenIso, isAlreadyLogged, phIsoDate, weekStartIso } from "@/lib/fitness";
import { getUserSettings } from "@/lib/settings";
import { formatWeight } from "@/lib/units";
import { RestReminderNotifier } from "@/components/rest-reminder";

/** Days in a row that trigger the rest reminder */
const REST_AFTER_DAYS = 3;

function relativeDate(dateStr: string): string {
  const diff = daysBetweenIso(dateStr, phIsoDate());
  const target = new Date(`${dateStr}T12:00:00Z`);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return target.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

interface SessionRow {
  id: string;
  date: string;
  is_rest_day: boolean;
  session_exercises: { count: number }[] | null;
  routines: { name: string } | null;
}

async function fetchDashboardData() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: sessions }, settings, { data: latestWeight }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, routine_id, date, is_rest_day, created_at, session_exercises(count), routines(name)")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    getUserSettings(supabase, user.id),
    supabase
      .from("body_weights")
      .select("weight, date")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1),
  ]);

  const all = ((sessions ?? []) as unknown as SessionRow[]).map((s) => ({
    id: s.id,
    date: s.date,
    isRest: !!s.is_rest_day,
    routineName: s.routines?.name ?? null,
    exCount: s.session_exercises?.[0]?.count ?? 0,
  }));

  const gymDates = all.filter((s) => !s.isRest).map((s) => s.date);
  const today = phIsoDate();
  const weekStart = weekStartIso();

  return {
    settings,
    streak: computeStreak(gymDates),
    weekGymDays: new Set(gymDates.filter((d) => d >= weekStart && d <= today)).size,
    totalWorkouts: gymDates.length,
    loggedToday: isAlreadyLogged(all.map((s) => s.date)),
    lastWorkout: all.find((s) => !s.isRest) ?? null,
    recent: all.slice(0, 5),
    bodyweight: latestWeight?.[0] ?? null,
  };
}

function GoalRing({ value, goal }: { value: number; goal: number }) {
  const pct = Math.min(1, goal ? value / goal : 0);
  const r = 34;
  const c = 2 * Math.PI * r;
  const met = value >= goal;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={met ? "#34d399" : "var(--accent)"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums">
          {value}/{goal}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">days</span>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const data = await fetchDashboardData();

  if (!data) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Please log in</h1>
        </div>
      </section>
    );
  }

  const { settings, streak, weekGymDays, totalWorkouts, loggedToday, lastWorkout, recent, bodyweight } = data;
  const goal = settings.weekly_goal;
  const remaining = Math.max(0, goal - weekGymDays);
  const suggestRest = settings.rest_day_reminders && streak >= REST_AFTER_DAYS && !loggedToday;

  if (recent.length === 0) {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/20 via-sky-400/5 to-transparent p-8 text-center">
          <p className="text-4xl">🏋️</p>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">Welcome to GymLog!</h1>
          <p className="mt-2 text-slate-400">Create a routine, then log your first workout.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/routines/new"
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-accent/90"
            >
              Create a routine
            </Link>
            <Link
              href="/log"
              className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/5"
            >
              Log a workout
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <Link
          href={loggedToday ? "/history" : "/log"}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-accent/90"
        >
          {loggedToday ? "✓ Logged today" : "Log Workout"}
        </Link>
      </div>

      {suggestRest && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
          <span className="text-2xl">😴</span>
          <div className="flex-1">
            <p className="font-medium text-foreground">You&apos;ve trained {streak} days in a row</p>
            <p className="text-sm text-slate-400">Consider a rest day. Muscles grow while you recover.</p>
          </div>
          <Link href="/log/rest" className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-accent hover:bg-sky-400/10">
            Log rest
          </Link>
          <RestReminderNotifier streak={streak} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Weekly goal */}
        <div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <GoalRing value={weekGymDays} goal={goal} />
          <div>
            <p className="text-sm text-slate-400">This week</p>
            <p className="mt-1 font-medium text-foreground">
              {remaining === 0 ? "Weekly goal hit! 🎉" : `${remaining} more ${remaining === 1 ? "day" : "days"} to hit your goal`}
            </p>
            <Link href="/profile" className="mt-1 inline-block text-xs text-slate-500 hover:text-accent">
              Goal: {goal} days/week · change
            </Link>
          </div>
        </div>

        {/* Streak + totals */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <p className="text-sm text-slate-400">Streak</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-accent">
              {streak > 0 ? "🔥 " : ""}
              {streak}
            </p>
            <p className="text-xs text-slate-500">{streak === 1 ? "day" : "days"} in a row</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <p className="text-sm text-slate-400">Workouts</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{totalWorkouts}</p>
            <p className="text-xs text-slate-500">all time</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {lastWorkout && (
          <Link
            href={`/history/${lastWorkout.id}`}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 transition-colors hover:border-accent"
          >
            <p className="text-sm text-slate-400">Last workout · {relativeDate(lastWorkout.date)}</p>
            <p className="mt-1 font-medium text-foreground">{lastWorkout.routineName ?? "Workout"}</p>
            <p className="text-sm text-slate-400">
              {lastWorkout.exCount} {lastWorkout.exCount === 1 ? "exercise" : "exercises"}
            </p>
          </Link>
        )}
        <Link
          href="/bodyweight"
          className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 transition-colors hover:border-accent"
        >
          <p className="text-sm text-slate-400">Bodyweight</p>
          <p className="mt-1 font-medium text-foreground">
            {bodyweight ? formatWeight(Number(bodyweight.weight), settings.units) : "Not logged yet"}
          </p>
          <p className="text-sm text-slate-400">
            {bodyweight ? relativeDate(bodyweight.date) : "Tap to add your weight"}
          </p>
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">Recent Activity</h2>
          <Link href="/history" className="text-sm text-slate-400 hover:text-accent">
            See all →
          </Link>
        </div>
        {recent.map((s) => (
          <Link
            key={s.id}
            href={`/history/${s.id}`}
            className="flex items-center gap-4 rounded-xl border border-white/10 bg-slate-900/60 p-3 transition-colors hover:border-accent"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-400/10 text-lg">
              {s.isRest ? "😴" : "🏋️"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                {s.isRest ? "Rest Day" : s.routineName ?? "Workout"}
              </p>
              <p className="text-sm text-slate-400">
                {relativeDate(s.date)}
                {!s.isRest && ` · ${s.exCount} ${s.exCount === 1 ? "exercise" : "exercises"}`}
              </p>
            </div>
            <span className="text-slate-600">›</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
