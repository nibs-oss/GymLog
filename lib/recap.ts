import { exerciseKey, libraryMuscle } from "./exercises.ts";
import { addDaysIso, addMonthsIso, setVolume } from "./fitness.ts";
import { newWeightPRs, type RecordSet } from "./records.ts";

export interface WeekRecap {
  from: string; // Monday, YYYY-MM-DD
  to: string; // Sunday
  workouts: number; // distinct gym days
  goal: number;
  volume: number; // kg (weight × reps, all sets)
  previousVolume: number; // the week before, for comparison
  prs: string[]; // exercises with a new heaviest weight
}

function volumeBetween(rows: RecordSet[], from: string, to: string) {
  return rows
    .filter((r) => r.date >= from && r.date <= to)
    .reduce((v, r) => v + setVolume(r.weight, r.reps), 0);
}

/** Recap of the Monday–Sunday week starting `weekStart`. `rows` must be oldest-first. */
export function weekRecap(rows: RecordSet[], gymDates: Iterable<string>, weekStart: string, goal: number): WeekRecap {
  const to = addDaysIso(weekStart, 6);
  const days = new Set([...gymDates].filter((d) => d >= weekStart && d <= to));
  return {
    from: weekStart,
    to,
    workouts: days.size,
    goal,
    volume: volumeBetween(rows, weekStart, to),
    previousVolume: volumeBetween(rows, addDaysIso(weekStart, -7), addDaysIso(weekStart, -1)),
    prs: newWeightPRs(rows, weekStart, to),
  };
}

/** Muscle groups with the most sets between `from` and `to`, most-trained first. */
export function topMuscles(rows: RecordSet[], from: string, to: string, limit = 2): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.date < from || r.date > to) continue;
    const muscle = r.muscle ?? libraryMuscle(r.exercise);
    if (muscle) counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([m]) => m);
}

export interface MonthRecap {
  month: string; // YYYY-MM
  from: string;
  to: string;
  workouts: number;
  previousWorkouts: number;
  restDays: number;
  sets: number;
  volume: number; // kg
  previousVolume: number;
  longestStreak: number; // consecutive gym days within the month
  prs: string[];
  topMuscles: string[];
  topExercises: { name: string; sets: number }[];
}

/** Recap of a calendar month (YYYY-MM) compared with the month before. `rows` oldest-first. */
export function monthRecap(
  rows: RecordSet[],
  gymDates: Iterable<string>,
  restDates: Iterable<string>,
  month: string
): MonthRecap {
  const from = `${month}-01`;
  const to = addDaysIso(addMonthsIso(from, 1), -1);
  const prevFrom = addMonthsIso(from, -1);
  const prevTo = addDaysIso(from, -1);
  const gym = [...new Set(gymDates)];
  const inMonth = gym.filter((d) => d >= from && d <= to).sort();

  let longestStreak = 0;
  let run = 0;
  for (let i = 0; i < inMonth.length; i++) {
    run = i > 0 && addDaysIso(inMonth[i - 1], 1) === inMonth[i] ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }

  const monthRows = rows.filter((r) => r.date >= from && r.date <= to);
  const setsByExercise = new Map<string, { name: string; sets: number }>();
  for (const r of monthRows) {
    const key = exerciseKey(r.exercise);
    const cur = setsByExercise.get(key) ?? { name: r.exercise, sets: 0 };
    cur.name = r.exercise;
    cur.sets++;
    setsByExercise.set(key, cur);
  }

  return {
    month,
    from,
    to,
    workouts: inMonth.length,
    previousWorkouts: gym.filter((d) => d >= prevFrom && d <= prevTo).length,
    restDays: new Set([...restDates].filter((d) => d >= from && d <= to)).size,
    sets: monthRows.length,
    volume: volumeBetween(rows, from, to),
    previousVolume: volumeBetween(rows, prevFrom, prevTo),
    longestStreak,
    prs: newWeightPRs(rows, from, to),
    topMuscles: topMuscles(rows, from, to, 3),
    topExercises: [...setsByExercise.values()].sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name)).slice(0, 3),
  };
}
