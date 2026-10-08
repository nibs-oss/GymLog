import { addDaysIso, daysBetweenIso } from "./fitness.ts";
import { exerciseKey } from "./exercises.ts";

/** A target like "Bench Press 100 kg × 1". Weights in kg. */
export interface LiftGoal {
  id: string;
  exercise: string;
  targetKg: number;
  reps: number; // the set must reach at least this many reps
  startKg: number | null; // best qualifying weight when the goal was set
  createdAt: string; // YYYY-MM-DD (PH)
}

export interface GoalProgress {
  goal: LiftGoal;
  currentKg: number | null; // best qualifying weight ever
  progress: number; // 0–1 from startKg to targetKg
  achievedOn: string | null;
  kgPerWeek: number | null; // recent trend, if there's enough data
  eta: string | null; // estimated date, if trending up
  etaTooFar: boolean; // more than 2 years away at this pace
}

const TREND_DAYS = 56; // look at the last 8 weeks
const MIN_SESSIONS = 3;
const MIN_SPAN_DAYS = 14;

/** Best weight per day for sets that reach `reps` (only for this exercise). */
function bestByDate(sets: { date: string; exercise: string; weight: number | null; reps: number | null }[], goal: LiftGoal) {
  const key = exerciseKey(goal.exercise);
  const best = new Map<string, number>();
  for (const s of sets) {
    if (exerciseKey(s.exercise) !== key || s.weight === null || (s.reps ?? 0) < goal.reps) continue;
    best.set(s.date, Math.max(best.get(s.date) ?? 0, s.weight));
  }
  return [...best.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** Best qualifying weight before today, for a new goal's starting point. */
export function startingPoint(
  sets: { date: string; exercise: string; weight: number | null; reps: number | null }[],
  exercise: string,
  reps: number
): number | null {
  const days = bestByDate(sets, { id: "", exercise, targetKg: 0, reps, startKg: null, createdAt: "" });
  return days.length ? Math.max(...days.map(([, w]) => w)) : null;
}

export function goalProgress(
  goal: LiftGoal,
  sets: { date: string; exercise: string; weight: number | null; reps: number | null }[],
  today: string
): GoalProgress {
  const days = bestByDate(sets, goal);
  let currentKg: number | null = null;
  let achievedOn: string | null = null;
  for (const [date, w] of days) {
    currentKg = Math.max(currentKg ?? 0, w);
    if (!achievedOn && w >= goal.targetKg) achievedOn = date;
  }

  const start = goal.startKg ?? 0;
  const progress =
    currentKg === null ? 0 : goal.targetKg <= start ? 1 : Math.min(1, Math.max(0, (currentKg - start) / (goal.targetKg - start)));

  // Linear trend (least squares) of the session-best weight over the last 8 weeks
  const recent = days.filter(([d]) => daysBetweenIso(d, today) <= TREND_DAYS);
  let kgPerWeek: number | null = null;
  if (recent.length >= MIN_SESSIONS && daysBetweenIso(recent[0][0], recent[recent.length - 1][0]) >= MIN_SPAN_DAYS) {
    const xs = recent.map(([d]) => daysBetweenIso(recent[0][0], d));
    const ys = recent.map(([, w]) => w);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
    const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    kgPerWeek = den ? (num / den) * 7 : null;
  }

  let eta: string | null = null;
  let etaTooFar = false;
  if (!achievedOn && currentKg !== null && kgPerWeek !== null && kgPerWeek > 0) {
    const daysLeft = Math.ceil(((goal.targetKg - currentKg) / kgPerWeek) * 7);
    if (daysLeft > 730) etaTooFar = true;
    else eta = addDaysIso(today, Math.max(1, daysLeft));
  }

  return { goal, currentKg, progress: achievedOn ? 1 : progress, achievedOn, kgPerWeek, eta, etaTooFar };
}
