import { test } from "node:test";
import assert from "node:assert/strict";
import { monthRecap, topMuscles, weekRecap } from "./recap.ts";
import type { RecordSet } from "./records.ts";

const set = (date: string, exercise: string, weight: number | null, reps: number | null): RecordSet => ({
  sessionId: `s-${date}`,
  date,
  exercise,
  muscle: null,
  weight,
  reps,
});

// Week of Mon 2026-09-28 .. Sun 2026-10-04, with the week before for comparison
const rows = [
  set("2026-09-22", "Bench Press", 60, 10), // previous week: 600
  set("2026-09-28", "Bench Press", 62.5, 8), // 500
  set("2026-09-30", "Dip", null, 12), // bodyweight: 0 volume
  set("2026-10-04", "Squat", 100, 5), // Sunday still counts: 500
  set("2026-10-05", "Bench Press", 70, 5), // next week: excluded
];

test("recaps a Monday–Sunday week", () => {
  const r = weekRecap(rows, ["2026-09-22", "2026-09-28", "2026-09-30", "2026-10-04", "2026-10-05"], "2026-09-28", 4);
  assert.equal(r.to, "2026-10-04");
  assert.equal(r.workouts, 3);
  assert.equal(r.goal, 4);
  assert.equal(r.volume, 1000);
  assert.equal(r.previousVolume, 600);
  assert.deepEqual(r.prs, ["Bench Press"]); // 62.5 beat 60; Squat is a first session
});

test("an empty week", () => {
  const r = weekRecap(rows, [], "2026-10-12", 3);
  assert.equal(r.workouts, 0);
  assert.equal(r.volume, 0);
  assert.deepEqual(r.prs, []);
});

test("top muscles by sets in a range, falling back to the exercise library", () => {
  const sets = [
    { ...set("2026-10-01", "Bench Press", 60, 8), muscle: "Chest" },
    { ...set("2026-10-01", "Bench Press", 60, 8), muscle: "Chest" },
    { ...set("2026-10-02", "Overhead Press", 40, 8), muscle: "Shoulders" },
    set("2026-10-02", "Squat", 100, 5), // no muscle saved -> library says Quads
    set("2026-10-02", "Squat", 100, 5),
    set("2026-10-02", "Squat", 100, 5),
    { ...set("2026-09-20", "Deadlift", 140, 3), muscle: "Back" }, // outside the range
  ];
  assert.deepEqual(topMuscles(sets, "2026-10-01", "2026-10-03"), ["Quads", "Chest"]);
});

test("month recap compares with the month before", () => {
  const sets = [
    set("2026-08-20", "Bench Press", 60, 10), // August: 600
    set("2026-09-01", "Bench Press", 62.5, 8), // 500, PR
    set("2026-09-01", "Bench Press", 62.5, 8), // 500
    set("2026-09-02", "Squat", 100, 5), // 500
    set("2026-09-03", "Dip", null, 12),
    set("2026-09-10", "Squat", 100, 5), // 500
    set("2026-10-01", "Squat", 120, 5), // October: excluded
  ];
  const gym = ["2026-08-20", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-10", "2026-10-01"];
  const r = monthRecap(sets, gym, ["2026-09-04", "2026-08-21"], "2026-09");
  assert.equal(r.to, "2026-09-30");
  assert.equal(r.workouts, 4);
  assert.equal(r.previousWorkouts, 1);
  assert.equal(r.restDays, 1);
  assert.equal(r.sets, 5);
  assert.equal(r.volume, 2000);
  assert.equal(r.previousVolume, 600);
  assert.equal(r.longestStreak, 3); // Sep 1–3
  assert.deepEqual(r.prs, ["Bench Press"]);
  assert.deepEqual(r.topExercises, [
    { name: "Bench Press", sets: 2 },
    { name: "Squat", sets: 2 },
    { name: "Dip", sets: 1 },
  ]);
});
