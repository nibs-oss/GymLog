import { test } from "node:test";
import assert from "node:assert/strict";
import { weekRecap } from "./recap.ts";
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
