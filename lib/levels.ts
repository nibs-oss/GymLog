import { exerciseKey, libraryMuscle } from "./exercises.ts";
import { setVolume } from "./fitness.ts";

/**
 * Character levels: XP from every workout, set, kilo lifted and new PR.
 * Purely derived from logged history, so nothing extra is stored.
 */
export const XP = { workout: 50, set: 10, per100kg: 1, pr: 50 } as const;

export function workoutXp(w: { sets: number; volumeKg: number; prs: number }) {
  return XP.workout + w.sets * XP.set + Math.floor(w.volumeKg / 100) * XP.per100kg + w.prs * XP.pr;
}

type Row = {
  sessionId: string;
  date: string;
  createdAt: string;
  exercise: string;
  muscle: string | null;
  weight: number | null;
  reps: number | null;
};

/**
 * Total XP from history. `rows` oldest-first. A PR is a session whose
 * heaviest set for an exercise beats every earlier session (first time
 * doing an exercise doesn't count, matching the PR banner).
 */
export function totalXp(rows: Row[]): { xp: number; workouts: number } {
  const sessions = new Map<string, Row[]>();
  for (const r of rows) {
    if (!sessions.has(r.sessionId)) sessions.set(r.sessionId, []);
    sessions.get(r.sessionId)!.push(r);
  }
  const best = new Map<string, number>();
  let xp = 0;
  for (const sets of sessions.values()) {
    const top = new Map<string, number>();
    for (const s of sets) {
      if (s.weight === null || s.weight <= 0) continue;
      const k = exerciseKey(s.exercise);
      top.set(k, Math.max(top.get(k) ?? 0, s.weight));
    }
    let prs = 0;
    for (const [k, w] of top) {
      if (best.has(k) && w > best.get(k)!) prs++;
      best.set(k, Math.max(best.get(k) ?? 0, w));
    }
    xp += workoutXp({ sets: sets.length, volumeKg: sets.reduce((v, s) => v + setVolume(s.weight, s.reps), 0), prs });
  }
  return { xp, workouts: sessions.size };
}

const TITLES: [number, string][] = [
  [45, "Legend"],
  [30, "Beast"],
  [20, "Athlete"],
  [10, "Lifter"],
  [5, "Regular"],
  [1, "Rookie"],
];

/** XP needed to reach `level` (Level 1 = 0, 2 = 100, 3 = 300, 4 = 600 …) */
export function xpForLevel(level: number) {
  return 50 * (level - 1) * level;
}

export function levelFor(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    title: TITLES.find(([min]) => level >= min)![1],
    xpIntoLevel: xp - floor,
    xpForNext: next - floor,
    progress: (xp - floor) / (next - floor),
  };
}

/** RPG-style stats from lifetime sets per body area. */
export const STAT_GROUPS: Record<string, string[]> = {
  Push: ["Chest", "Shoulders", "Triceps"],
  Pull: ["Back", "Biceps"],
  Legs: ["Quads", "Hamstrings", "Glutes", "Calves"],
  Core: ["Core"],
};

/** Stat level from sets: 10 sets -> Lv 2, 40 -> 3, 90 -> 4, 160 -> 5 … */
export function statLevel(sets: number) {
  const level = Math.floor(Math.sqrt(sets / 10)) + 1;
  const floor = 10 * (level - 1) ** 2;
  const next = 10 * level ** 2;
  return { level, progress: (sets - floor) / (next - floor) };
}

export function characterStats(rows: { exercise: string; muscle: string | null }[]) {
  const sets = Object.fromEntries(Object.keys(STAT_GROUPS).map((s) => [s, 0]));
  for (const r of rows) {
    const muscle = r.muscle ?? libraryMuscle(r.exercise);
    const stat = Object.keys(STAT_GROUPS).find((s) => muscle && STAT_GROUPS[s].includes(muscle));
    if (stat) sets[stat]++;
  }
  return Object.keys(STAT_GROUPS).map((name) => ({ name, sets: sets[name], ...statLevel(sets[name]) }));
}
