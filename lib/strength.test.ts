import { test } from "node:test";
import assert from "node:assert/strict";
import { bestLifts, strengthLevels } from "./strength.ts";

const set = (exercise: string, weight: number | null, reps: number | null) => ({ exercise, weight, reps });

test("best estimated 1RM per lift, matching common names", () => {
  const best = bestLifts([
    set("Bench Press", 80, 1), // 80
    set("barbell bench press", 70, 6), // 84
    set("Back Squat", 100, 5), // ~116.7
    set("Incline Bench Press", 100, 1), // not the bench standard
    set("Dip", null, 12),
  ]);
  assert.equal(best.get("bench"), 84);
  assert.equal(Math.round(best.get("squat")!), 117);
  assert.equal(best.has("deadlift"), false);
});

test("levels from 1RM relative to bodyweight", () => {
  const lv = strengthLevels(new Map([["bench", 80], ["squat", 40]]), 80, "male");
  const bench = lv.find((l) => l.id === "bench")!;
  assert.equal(bench.ratio, 1);
  assert.equal(bench.level, "Intermediate"); // 1.0× BW
  assert.equal(bench.next?.level, "Advanced");
  assert.equal(bench.next?.kgToGo, 40); // 1.5× BW = 120 kg
  assert.equal(bench.next?.progress, 0);

  const squat = lv.find((l) => l.id === "squat")!;
  assert.equal(squat.level, "Beginner"); // below the first threshold still shows Beginner
  assert.equal(squat.next?.level, "Novice");

  assert.equal(lv.find((l) => l.id === "deadlift")!.level, null); // never logged
});

test("women's standards differ", () => {
  const [, bench] = strengthLevels(new Map([["bench", 60]]), 60, "female");
  assert.equal(bench.level, "Advanced"); // 1.0× BW
});

test("top level has no next target", () => {
  const ohp = strengthLevels(new Map([["ohp", 110]]), 80, "male").find((l) => l.id === "ohp")!;
  assert.equal(ohp.level, "Elite");
  assert.equal(ohp.next, null);
});
