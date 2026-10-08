import { test } from "node:test";
import assert from "node:assert/strict";
import { goalProgress, startingPoint, type LiftGoal } from "./goals.ts";

const set = (date: string, exercise: string, weight: number | null, reps: number | null) => ({ date, exercise, weight, reps });
const goal = (over: Partial<LiftGoal> = {}): LiftGoal => ({
  id: "g1",
  exercise: "Bench Press",
  targetKg: 100,
  reps: 1,
  startKg: 80,
  createdAt: "2026-09-01",
  ...over,
});

// One session a week, +2.5 kg each time
const sets = [
  set("2026-09-03", "Bench Press", 80, 5),
  set("2026-09-10", "bench press", 82.5, 5),
  set("2026-09-17", "Bench Press", 85, 5),
  set("2026-09-24", "Bench Press", 87.5, 5),
  set("2026-10-01", "Bench Press", 90, 3),
  set("2026-10-01", "Bench Press", 95, 1), // heavier single, same day
  set("2026-10-01", "Squat", 140, 5),
];

test("progress from start to target using the best qualifying set", () => {
  const p = goalProgress(goal(), sets, "2026-10-08");
  assert.equal(p.currentKg, 95);
  assert.equal(p.progress, 0.75); // (95 - 80) / (100 - 80)
  assert.equal(p.achievedOn, null);
});

test("rep target: only sets with enough reps count", () => {
  const p = goalProgress(goal({ targetKg: 90, reps: 5, startKg: 80 }), sets, "2026-10-08");
  assert.equal(p.currentKg, 87.5);
  assert.equal(p.progress, 0.75);
});

test("estimate from the recent trend", () => {
  const p = goalProgress(goal({ reps: 5 }), sets, "2026-10-08");
  assert.equal(p.kgPerWeek, 2.5);
  // 87.5 -> 100 at 2.5 kg/week = 5 weeks
  assert.equal(p.eta, "2026-11-12");
});

test("achieved goals record the date and stop estimating", () => {
  const p = goalProgress(goal({ targetKg: 85, reps: 5 }), sets, "2026-10-08");
  assert.equal(p.achievedOn, "2026-09-17");
  assert.equal(p.progress, 1);
  assert.equal(p.eta, null);
});

test("no estimate without enough recent data or when not improving", () => {
  assert.equal(goalProgress(goal(), sets.slice(0, 2), "2026-10-08").eta, null);
  const flat = [set("2026-09-10", "Bench Press", 80, 5), set("2026-09-24", "Bench Press", 80, 5), set("2026-10-01", "Bench Press", 80, 5)];
  const p = goalProgress(goal(), flat, "2026-10-08");
  assert.equal(p.kgPerWeek, 0);
  assert.equal(p.eta, null);
});

test("starting point is the best qualifying weight so far", () => {
  assert.equal(startingPoint(sets, "bench press", 5), 87.5);
  assert.equal(startingPoint(sets, "Deadlift", 1), null);
});
