import { exerciseKey } from "./exercises.ts";
import { estimate1RM } from "./fitness.ts";

/** One logged set, as much as records need (weights in kg). */
export interface RecordSet {
  sessionId: string;
  date: string; // YYYY-MM-DD (PH)
  exercise: string;
  muscle: string | null;
  weight: number | null;
  reps: number | null;
}

interface Hit {
  weight: number | null;
  reps: number | null;
  date: string;
  sessionId: string;
}

export interface ExerciseRecords {
  name: string; // most recent spelling
  muscle: string | null;
  heaviest: Hit | null; // highest weight (ties: more reps)
  best1RM: (Hit & { value: number }) | null; // highest estimated 1-rep max
  mostReps: Hit | null; // most reps in one set (ties: heavier)
  lastRecordDate: string; // newest date any record was set
}

/** Personal records per exercise, newest record first. `rows` must be oldest-first. */
export function personalRecords(rows: RecordSet[]): ExerciseRecords[] {
  const out = new Map<string, ExerciseRecords>();
  for (const r of rows) {
    const key = exerciseKey(r.exercise);
    let rec = out.get(key);
    if (!rec) {
      rec = { name: r.exercise, muscle: r.muscle, heaviest: null, best1RM: null, mostReps: null, lastRecordDate: r.date };
      out.set(key, rec);
    }
    rec.name = r.exercise;
    if (r.muscle) rec.muscle = r.muscle;
    const hit: Hit = { weight: r.weight, reps: r.reps, date: r.date, sessionId: r.sessionId };

    if (
      r.weight !== null &&
      r.weight > 0 &&
      (!rec.heaviest ||
        r.weight > rec.heaviest.weight! ||
        (r.weight === rec.heaviest.weight && (r.reps ?? 0) > (rec.heaviest.reps ?? 0)))
    ) {
      rec.heaviest = hit;
      rec.lastRecordDate = r.date;
    }
    const e = estimate1RM(r.weight, r.reps);
    if (e !== null && (!rec.best1RM || e > rec.best1RM.value)) {
      rec.best1RM = { ...hit, value: e };
      rec.lastRecordDate = r.date;
    }
    if (
      r.reps !== null &&
      r.reps > 0 &&
      (!rec.mostReps ||
        r.reps > rec.mostReps.reps! ||
        (r.reps === rec.mostReps.reps && (r.weight ?? 0) > (rec.mostReps.weight ?? 0)))
    ) {
      rec.mostReps = hit;
      rec.lastRecordDate = r.date;
    }
  }
  return [...out.values()].sort((a, b) =>
    a.lastRecordDate === b.lastRecordDate ? a.name.localeCompare(b.name) : a.lastRecordDate < b.lastRecordDate ? 1 : -1
  );
}

/**
 * Exercises whose heaviest weight between `from` and `to` (inclusive) beat
 * everything logged before `from`. First-ever sessions don't count as PRs.
 */
export function newWeightPRs(rows: RecordSet[], from: string, to: string): string[] {
  const before = new Map<string, number>();
  const during = new Map<string, { name: string; weight: number }>();
  for (const r of rows) {
    if (r.weight === null || r.weight <= 0) continue;
    const key = exerciseKey(r.exercise);
    if (r.date < from) {
      before.set(key, Math.max(before.get(key) ?? 0, r.weight));
    } else if (r.date <= to) {
      const cur = during.get(key);
      if (!cur || r.weight > cur.weight) during.set(key, { name: r.exercise, weight: r.weight });
    }
  }
  return [...during.entries()]
    .filter(([key, d]) => before.has(key) && d.weight > before.get(key)!)
    .map(([, d]) => d.name);
}
