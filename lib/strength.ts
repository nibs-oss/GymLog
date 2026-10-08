import { exerciseKey } from "./exercises.ts";
import { estimate1RM } from "./fitness.ts";

/**
 * Strength level from estimated 1-rep max relative to bodyweight, for the
 * four big barbell lifts. Thresholds are rounded versions of widely used
 * community standards (Beginner → Elite); a rough guide, not a test.
 */
export type Sex = "male" | "female";

export const LEVELS = ["Beginner", "Novice", "Intermediate", "Advanced", "Elite"] as const;
export type Level = (typeof LEVELS)[number];

export const LIFTS = [
  { id: "squat", name: "Squat", aliases: ["squat", "back squat", "barbell squat", "barbell back squat"] },
  { id: "bench", name: "Bench Press", aliases: ["bench press", "barbell bench press", "flat bench press", "bench"] },
  { id: "deadlift", name: "Deadlift", aliases: ["deadlift", "conventional deadlift", "barbell deadlift"] },
  { id: "ohp", name: "Overhead Press", aliases: ["overhead press", "military press", "ohp", "barbell overhead press", "standing press"] },
] as const;
export type LiftId = (typeof LIFTS)[number]["id"];

/** 1RM ÷ bodyweight needed for each level, in LEVELS order */
const STANDARDS: Record<Sex, Record<LiftId, number[]>> = {
  male: {
    squat: [0.75, 1.25, 1.5, 2.25, 2.75],
    bench: [0.5, 0.75, 1.0, 1.5, 2.0],
    deadlift: [1.0, 1.5, 2.0, 2.5, 3.0],
    ohp: [0.35, 0.55, 0.75, 1.0, 1.25],
  },
  female: {
    squat: [0.5, 0.75, 1.25, 1.5, 2.0],
    bench: [0.25, 0.5, 0.75, 1.0, 1.5],
    deadlift: [0.5, 1.0, 1.25, 1.75, 2.5],
    ohp: [0.2, 0.35, 0.5, 0.75, 1.0],
  },
};

export interface LiftLevel {
  id: LiftId;
  name: string;
  oneRM: number | null; // kg, best estimated
  ratio: number | null; // oneRM / bodyweight
  level: Level | null;
  next: { level: Level; kgToGo: number; progress: number } | null; // progress 0–1 within current level
}

/** Best estimated 1RM per big lift from logged sets (kg). */
export function bestLifts(sets: { exercise: string; weight: number | null; reps: number | null }[]) {
  const best = new Map<LiftId, number>();
  for (const s of sets) {
    const key = exerciseKey(s.exercise);
    const lift = LIFTS.find((l) => (l.aliases as readonly string[]).includes(key));
    const e = lift ? estimate1RM(s.weight, s.reps) : null;
    if (lift && e !== null && e > (best.get(lift.id) ?? 0)) best.set(lift.id, e);
  }
  return best;
}

export function strengthLevels(best: Map<LiftId, number>, bodyweight: number, sex: Sex): LiftLevel[] {
  return LIFTS.map((lift) => {
    const oneRM = best.get(lift.id) ?? null;
    if (oneRM === null || bodyweight <= 0) {
      return { id: lift.id, name: lift.name, oneRM, ratio: null, level: null, next: null };
    }
    const t = STANDARDS[sex][lift.id];
    const ratio = oneRM / bodyweight;
    let i = 0;
    while (i + 1 < t.length && ratio >= t[i + 1]) i++;
    const hasNext = i + 1 < t.length;
    const floor = ratio >= t[0] ? t[i] : 0;
    return {
      id: lift.id,
      name: lift.name,
      oneRM,
      ratio,
      level: LEVELS[i],
      next: hasNext
        ? {
            level: LEVELS[i + 1],
            kgToGo: Math.max(0, t[i + 1] * bodyweight - oneRM),
            progress: Math.min(1, Math.max(0, (ratio - floor) / (t[i + 1] - floor))),
          }
        : null,
    };
  });
}
