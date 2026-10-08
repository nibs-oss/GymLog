import { test } from "node:test";
import assert from "node:assert/strict";
import { characterStats, levelFor, statLevel, totalXp, workoutXp, xpForLevel } from "./levels.ts";

const set = (sessionId: string, exercise: string, weight: number | null, reps: number | null, muscle: string | null = null) => ({
  sessionId,
  date: "2026-10-01",
  createdAt: `2026-10-01T${sessionId}`,
  exercise,
  muscle,
  weight,
  reps,
});

test("workout XP: base + sets + volume + PRs", () => {
  assert.equal(workoutXp({ sets: 12, volumeKg: 4250, prs: 1 }), 50 + 120 + 42 + 50);
});

test("total XP over history; first time on an exercise isn't a PR", () => {
  const rows = [
    set("s1", "Bench Press", 60, 10), // 600 kg
    set("s1", "Bench Press", 60, 10), // 600 kg -> s1: 50 + 20 + 12 = 82
    set("s2", "bench press", 65, 5), // PR (65 > 60), 325 kg -> 50 + 10 + 3 + 50 = 113
    set("s2", "Dip", null, 12), // bodyweight: a set, no volume -> +10
  ];
  const t = totalXp(rows);
  assert.equal(t.workouts, 2);
  assert.equal(t.xp, 82 + 113 + 10);
});

test("level curve and titles", () => {
  assert.deepEqual([1, 2, 3, 4, 10].map(xpForLevel), [0, 100, 300, 600, 4500]);
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(0).title, "Rookie");
  assert.equal(levelFor(99).level, 1);
  const l = levelFor(350);
  assert.equal(l.level, 3);
  assert.equal(l.xpIntoLevel, 50);
  assert.equal(l.xpForNext, 300);
  assert.equal(levelFor(xpForLevel(10)).title, "Lifter");
  assert.equal(levelFor(xpForLevel(45)).title, "Legend");
});

test("stats grow from sets per body area", () => {
  assert.deepEqual(statLevel(0), { level: 1, progress: 0 });
  assert.equal(statLevel(10).level, 2);
  assert.equal(statLevel(40).level, 3);
  const stats = characterStats([
    ...Array.from({ length: 12 }, () => set("s", "Bench Press", 60, 8)), // library: Chest -> Push
    ...Array.from({ length: 3 }, () => set("s", "Curl", 10, 10, "Biceps")), // Pull
    set("s", "Treadmill", null, null, "Cardio"), // not a stat
  ]);
  assert.deepEqual(
    stats.map((s) => [s.name, s.sets, s.level]),
    [["Push", 12, 2], ["Pull", 3, 1], ["Legs", 0, 1], ["Core", 0, 1]]
  );
});
