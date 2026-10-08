import { test } from "node:test";
import assert from "node:assert/strict";
import { newWeightPRs, personalRecords, type RecordSet } from "./records.ts";

const set = (date: string, exercise: string, weight: number | null, reps: number | null): RecordSet => ({
  sessionId: `s-${date}`,
  date,
  exercise,
  muscle: null,
  weight,
  reps,
});

const rows = [
  set("2026-09-01", "Bench Press", 60, 8),
  set("2026-09-01", "Bench Press", 60, 10),
  set("2026-09-08", "bench press", 70, 3), // same exercise, different casing
  set("2026-09-08", "Dip", null, 12),
  set("2026-09-15", "Dip", null, 15),
  set("2026-09-15", "Squat", 100, 5),
];

test("records per exercise: heaviest, best est. 1RM, most reps", () => {
  const recs = personalRecords(rows);
  const bench = recs.find((r) => r.name === "bench press")!;
  assert.equal(bench.heaviest?.weight, 70);
  assert.equal(bench.heaviest?.date, "2026-09-08");
  assert.equal(bench.mostReps?.reps, 10);
  // 60x10 -> 80, 70x3 -> 77 (Epley)
  assert.equal(Math.round(bench.best1RM!.value), 80);
  assert.equal(bench.best1RM?.date, "2026-09-01");

  const dip = recs.find((r) => r.name === "Dip")!;
  assert.equal(dip.heaviest, null); // bodyweight only
  assert.equal(dip.mostReps?.reps, 15);
});

test("newest records first", () => {
  assert.deepEqual(
    personalRecords(rows).map((r) => r.name),
    ["Dip", "Squat", "bench press"]
  );
});

test("weight PRs in a date range only count beats over earlier history", () => {
  assert.deepEqual(newWeightPRs(rows, "2026-09-07", "2026-09-13"), ["bench press"]);
  // Squat's first session isn't a PR; Dip has no weight
  assert.deepEqual(newWeightPRs(rows, "2026-09-14", "2026-09-20"), []);
});
