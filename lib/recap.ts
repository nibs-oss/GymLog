import { addDaysIso, setVolume } from "./fitness.ts";
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
