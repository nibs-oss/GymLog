export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient as createServerClient } from "@/utils/supabase/server";
import {
  addDaysIso,
  consecutiveDays,
  daysBetweenIso,
  isAlreadyLogged,
  streakInfo,
  phIsoDate,
  weekdayOf,
  weekStartIso,
} from "@/lib/fitness";
import { fetchLoggedSets } from "@/lib/history";
import { topMuscles, weekRecap, type WeekRecap } from "@/lib/recap";
import { muscleRecovery, RECOVERY_GROUPS } from "@/lib/recovery";
import { levelFor, totalXp } from "@/lib/levels";
import { getUserSettings } from "@/lib/settings";
import { formatWeight, type Units } from "@/lib/units";
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
  routine_id: string | null;
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

  const [{ data: sessions }, settings, { data: latestWeight }, rows, { data: routineRows }] = await Promise.all([
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
    fetchLoggedSets(supabase, user.id),
    supabase.from("routines").select("id, name").eq("user_id", user.id),
  ]);

  const all = ((sessions ?? []) as unknown as SessionRow[]).map((s) => ({
    id: s.id,
    routineId: s.routine_id,
    date: s.date,
    isRest: !!s.is_rest_day,
    routineName: s.routines?.name ?? null,
    exCount: s.session_exercises?.[0]?.count ?? 0,
  }));

  const gymDates = all.filter((s) => !s.isRest).map((s) => s.date);
  const today = phIsoDate();
  const weekStart = weekStartIso();
  const lastWeekStart = addDaysIso(weekStart, -7);

  // Streak forgives one missed day per week; the rest reminder counts true back-to-back days
  const { streak, frozen } = streakInfo(gymDates);
  const inARow = consecutiveDays(gymDates);

  const lastMonth = addDaysIso(`${today.slice(0, 7)}-01`, -1).slice(0, 7); // YYYY-MM

  // This week's plan (Mon–Sun) with what was actually logged
  const routineName = new Map((routineRows ?? []).map((r) => [r.id as string, r.name as string]));
  const loggedDates = new Set(all.map((s) => s.date));
  const plan = Object.keys(settings.schedule).length
    ? Array.from({ length: 7 }, (_, i) => {
        const date = addDaysIso(weekStart, i);
        const entry = settings.schedule[weekdayOf(date)] ?? null;
        return {
          date,
          isToday: date === today,
          isPast: date < today,
          done: loggedDates.has(date),
          rest: entry === "rest",
          routineId: entry && entry !== "rest" && routineName.has(entry) ? entry : null,
          routineName: entry && entry !== "rest" ? routineName.get(entry) ?? null : null,
        };
      })
    : null;

  // Which muscles are fresh vs still recovering right now
  const recovery = muscleRecovery(rows, new Date());
  const recovering = RECOVERY_GROUPS.filter((g) => recovery[g] && recovery[g].status !== "fresh");
  const fresh = RECOVERY_GROUPS.filter((g) => !recovery[g] || recovery[g].status === "fresh");

  return {
    settings,
    plan,
    readiness: rows.length ? { fresh, recovering } : null,
    level: levelFor(totalXp(rows).xp),
    streak,
    freezeUsedThisWeek: frozen.some((d) => d >= weekStart),
    inARow,
    // What the current run of training days hit hardest, for the rest reminder
    streakMuscles: topMuscles(rows, addDaysIso(today, -inARow), today),
    weekGymDays: new Set(gymDates.filter((d) => d >= weekStart && d <= today)).size,
    totalWorkouts: gymDates.length,
    loggedToday: isAlreadyLogged(all.map((s) => s.date)),
    lastWorkout: all.find((s) => !s.isRest) ?? null,
    recent: all.slice(0, 5),
    bodyweight: latestWeight?.[0] ?? null,
    // First week of a month: point to last month's report if there was training
    reportMonth:
      Number(today.slice(8, 10)) <= 7 && gymDates.some((d) => d.startsWith(lastMonth)) ? lastMonth : null,
    // Only once there's history from before this week to look back on
    lastWeek: all.some((s) => s.date < weekStart)
      ? weekRecap(rows, gymDates, lastWeekStart, settings.weekly_goal)
      : null,
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
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--ring-track)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={met ? "var(--color-emerald-400)" : "var(--accent)"}
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

type PlanDay = {
  date: string;
  isToday: boolean;
  isPast: boolean;
  done: boolean;
  rest: boolean;
  routineId: string | null;
  routineName: string | null;
};

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** Today's planned session with a start button, plus the Mon–Sun plan vs what was logged */
function PlanCard({ plan, loggedToday }: { plan: PlanDay[]; loggedToday: boolean }) {
  const today = plan.find((d) => d.isToday)!;
  const title = today.rest
    ? "Rest day"
    : today.routineName
      ? today.routineName
      : "Nothing planned";
  return (
    <div className="rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/15 via-sky-400/5 to-transparent p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-400">Today&apos;s plan</p>
          <p className="truncate text-lg font-semibold text-foreground">
            {title}
          </p>
        </div>
        {loggedToday ? (
          <span className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-emerald-400">✓ Done</span>
        ) : today.routineId ? (
          <Link
            href={`/log/${today.routineId}`}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-accent/90"
          >
            Start
          </Link>
        ) : today.rest ? (
          <Link
            href="/log/rest"
            className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium hover:bg-white/5"
          >
            Log rest
          </Link>
        ) : null}
      </div>
      <ol className="mt-4 grid grid-cols-7 gap-1.5 text-center">
        {plan.map((d, i) => {
          const missed = d.isPast && !d.done && !!d.routineName;
          const mark = d.done ? "✓" : d.rest ? "Rest" : d.routineName ? "•" : "";
          return (
            <li
              key={d.date}
              title={d.rest ? "Rest day" : d.routineName ?? "Nothing planned"}
              className={`rounded-lg py-1.5 ${d.isToday ? "ring-2 ring-accent" : ""} ${
                d.done ? "bg-accent/20" : missed ? "bg-red-500/10" : "bg-slate-950/40"
              }`}
            >
              <span className="block text-[11px] font-medium text-slate-400">{DAY_LETTERS[i]}</span>
              <span
                className={`block h-5 text-sm font-semibold ${
                  d.done ? "text-accent" : missed ? "text-red-400" : "text-slate-400"
                }`}
              >
                {missed ? "✕" : mark}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function rangeLabel(from: string, to: string) {
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(from)} – ${fmt(to)}`;
}

/** Monday–Sunday recap of last week: workouts vs goal, volume, new PRs */
function WeekRecapCard({ recap, units }: { recap: WeekRecap; units: Units }) {
  const met = recap.workouts >= recap.goal;
  const change =
    recap.previousVolume > 0 ? Math.round(((recap.volume - recap.previousVolume) / recap.previousVolume) * 100) : null;
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium text-foreground">Last week</h2>
        <span className="text-xs text-slate-500">{rangeLabel(recap.from, recap.to)}</span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs text-slate-500">Workouts</dt>
          <dd className={`text-xl font-semibold tabular-nums ${met ? "text-emerald-400" : ""}`}>
            {recap.workouts}/{recap.goal}
            {met ? " ✓" : ""}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">Volume</dt>
          <dd className="truncate text-xl font-semibold tabular-nums">{formatWeight(recap.volume, units)}</dd>
          {change !== null && (
            <dd className={`text-xs tabular-nums ${change >= 0 ? "text-emerald-400" : "text-slate-400"}`}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs week before
            </dd>
          )}
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">New PRs</dt>
          <dd className={`text-xl font-semibold tabular-nums ${recap.prs.length ? "text-amber-400" : ""}`}>
            {recap.prs.length}
          </dd>
          {recap.prs.length > 0 && <dd className="truncate text-xs text-slate-400">{recap.prs.join(", ")}</dd>}
        </div>
      </dl>
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

  const { settings, plan, readiness, level, reportMonth, streak, freezeUsedThisWeek, inARow, streakMuscles, weekGymDays, totalWorkouts, loggedToday, lastWorkout, recent, bodyweight, lastWeek } =
    data;
  const goal = settings.weekly_goal;
  const remaining = Math.max(0, goal - weekGymDays);
  const suggestRest = settings.rest_day_reminders && inARow >= REST_AFTER_DAYS && !loggedToday;

  if (recent.length === 0) {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/20 via-sky-400/5 to-transparent p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Welcome to GymLog!</h1>
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
          <Link href="/profile" className="text-sm text-slate-400 hover:text-accent">
            Level {level.level} · {level.title}
          </Link>
        </div>
        <Link
          href={loggedToday ? "/history" : "/log"}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-accent/90"
        >
          {loggedToday ? "✓ Logged today" : "Log Workout"}
        </Link>
      </div>

      {plan && <PlanCard plan={plan} loggedToday={loggedToday} />}

      {readiness && (
        <Link
          href="/progress"
          className="block rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-3 text-sm transition-colors hover:border-accent"
        >
          <span className="font-medium text-foreground">Recovery</span>
          <span className="text-slate-400">
            {" · "}
            <span className="text-emerald-400">Fresh:</span>{" "}
            {readiness.fresh.length ? readiness.fresh.join(", ") : "none yet"}
            {readiness.recovering.length > 0 && (
              <>
                {" · "}
                <span className="text-red-400">Recovering:</span> {readiness.recovering.join(", ")}
              </>
            )}
          </span>
        </Link>
      )}

      {suggestRest && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
          <div className="flex-1">
            <p className="font-medium text-foreground">You&apos;ve trained {inARow} days in a row</p>
            <p className="text-sm text-slate-400">
              {streakMuscles.length
                ? `Mostly ${streakMuscles.join(" and ")} lately. Give them a day off; muscles grow while you recover.`
                : "Consider a rest day. Muscles grow while you recover."}
            </p>
          </div>
          <Link href="/log/rest" className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-accent hover:bg-sky-400/10">
            Log rest
          </Link>
          <RestReminderNotifier streak={inARow} muscles={streakMuscles} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Weekly goal */}
        <div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <GoalRing value={weekGymDays} goal={goal} />
          <div>
            <p className="text-sm text-slate-400">This week</p>
            <p className="mt-1 font-medium text-foreground">
              {remaining === 0 ? "Weekly goal hit!" : `${remaining} more ${remaining === 1 ? "day" : "days"} to hit your goal`}
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
              {streak}
            </p>
            <p className="text-xs text-slate-500">training {streak === 1 ? "day" : "days"}</p>
            {streak > 0 && (
              <p
                className="mt-1 text-[11px] text-slate-500"
                title="One missed day per week (Mon–Sun) doesn't break your streak"
              >
                {freezeUsedThisWeek ? "Freeze used this week" : "1 freeze left this week"}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <p className="text-sm text-slate-400">Workouts</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{totalWorkouts}</p>
            <p className="text-xs text-slate-500">all time</p>
          </div>
        </div>
      </div>

      {reportMonth && (
        <Link
          href={`/progress/report?month=${reportMonth}`}
          className="flex items-center gap-3 rounded-2xl border border-sky-400/25 bg-sky-400/5 p-4 transition-colors hover:border-accent"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-foreground">
              Your{" "}
              {new Date(`${reportMonth}-15T12:00:00Z`).toLocaleDateString(undefined, { month: "long", timeZone: "UTC" })}{" "}
              report is ready
            </span>
            <span className="block text-sm text-slate-400">Workouts, volume, PRs and more</span>
          </span>
          <span className="text-slate-500">›</span>
        </Link>
      )}

      {lastWeek && <WeekRecapCard recap={lastWeek} units={settings.units} />}

      <div className="grid gap-4 sm:grid-cols-2">
        {lastWorkout && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-5 transition-colors hover:border-accent">
            <Link href={`/history/${lastWorkout.id}`} className="min-w-0 flex-1">
              <p className="text-sm text-slate-400">Last workout · {relativeDate(lastWorkout.date)}</p>
              <p className="mt-1 truncate font-medium text-foreground">{lastWorkout.routineName ?? "Workout"}</p>
              <p className="text-sm text-slate-400">
                {lastWorkout.exCount} {lastWorkout.exCount === 1 ? "exercise" : "exercises"}
              </p>
            </Link>
            {/* Routine still exists and today is free: start it again in one tap */}
            {lastWorkout.routineId && lastWorkout.routineName && !loggedToday && (
              <Link
                href={`/log/${lastWorkout.routineId}`}
                className="shrink-0 rounded-lg border border-sky-400/40 px-3 py-2 text-sm font-medium text-accent hover:bg-sky-400/10"
              >
                Repeat
              </Link>
            )}
          </div>
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
