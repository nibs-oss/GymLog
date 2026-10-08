import { libraryMuscle } from "./exercises.ts";

/**
 * Rough per-muscle recovery from the last time each muscle group was trained.
 * Big muscles need ~48 h, smaller ones ~36 h; a heavy session (9+ sets)
 * needs 50% longer. A guide for planning, not a medical measure.
 */
export type RecoveryStatus = "recovering" | "almost" | "fresh";

export interface MuscleRecovery {
  pct: number; // 0–1 of the recovery time that has passed
  status: RecoveryStatus;
  lastTrained: string; // ISO timestamp of that session
  sets: number; // sets for this muscle in that session
  readyAt: string; // ISO timestamp when it's fully recovered
}

/** Groups shown on the body map */
export const RECOVERY_GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Core",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
] as const;

const SMALL = new Set(["Shoulders", "Biceps", "Triceps", "Calves", "Core"]);
const HEAVY_SETS = 9;

export function recoveryHours(group: string, sets: number) {
  return (SMALL.has(group) ? 36 : 48) * (sets >= HEAVY_SETS ? 1.5 : 1);
}

export function statusOf(pct: number): RecoveryStatus {
  return pct >= 1 ? "fresh" : pct >= 0.5 ? "almost" : "recovering";
}

export function muscleRecovery(
  rows: { sessionId: string; createdAt: string; exercise: string; muscle: string | null }[],
  now: Date
): Record<string, MuscleRecovery> {
  // Latest session per muscle group, and how many sets it got there
  const latest = new Map<string, { sessionId: string; createdAt: string; sets: number }>();
  for (const r of rows) {
    const group = r.muscle ?? libraryMuscle(r.exercise);
    if (!group || !(RECOVERY_GROUPS as readonly string[]).includes(group)) continue;
    const cur = latest.get(group);
    if (!cur || r.createdAt > cur.createdAt) latest.set(group, { sessionId: r.sessionId, createdAt: r.createdAt, sets: 1 });
    else if (r.sessionId === cur.sessionId) cur.sets++;
  }

  const out: Record<string, MuscleRecovery> = {};
  for (const [group, s] of latest) {
    const hours = recoveryHours(group, s.sets);
    const since = (now.getTime() - new Date(s.createdAt).getTime()) / 3_600_000;
    const pct = Math.max(0, Math.min(1, since / hours));
    out[group] = {
      pct,
      status: statusOf(pct),
      lastTrained: s.createdAt,
      sets: s.sets,
      readyAt: new Date(new Date(s.createdAt).getTime() + hours * 3_600_000).toISOString(),
    };
  }
  return out;
}
