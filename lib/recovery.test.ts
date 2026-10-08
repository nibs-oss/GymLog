import { test } from "node:test";
import assert from "node:assert/strict";
import { muscleRecovery, recoveryHours } from "./recovery.ts";

const row = (sessionId: string, createdAt: string, exercise: string, muscle: string | null = null) => ({
  sessionId,
  createdAt,
  exercise,
  muscle,
});

test("recovery time: big vs small muscles, longer after a heavy session", () => {
  assert.equal(recoveryHours("Chest", 6), 48);
  assert.equal(recoveryHours("Biceps", 6), 36);
  assert.equal(recoveryHours("Quads", 10), 72);
});

test("status from hours since each muscle's latest session", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const rows = [
    // Chest 2 days ago (4 sets) -> fully recovered
    ...Array.from({ length: 4 }, () => row("s1", "2026-10-06T12:00:00Z", "Bench Press")),
    // Quads 30 h ago, 10 sets (heavy) -> 30/72 -> recovering
    ...Array.from({ length: 10 }, () => row("s2", "2026-10-07T06:00:00Z", "Squat")),
    // Biceps 24 h ago, 3 sets -> 24/36 -> almost
    ...Array.from({ length: 3 }, () => row("s3", "2026-10-07T12:00:00Z", "Curl", "Biceps")),
    // Cardio isn't on the body map
    row("s3", "2026-10-07T12:00:00Z", "Treadmill", "Cardio"),
  ];
  const r = muscleRecovery(rows, now);
  assert.equal(r.Chest.status, "fresh");
  assert.equal(r.Chest.pct, 1);
  assert.equal(r.Quads.status, "recovering");
  assert.equal(r.Quads.sets, 10);
  assert.equal(r.Quads.readyAt, "2026-10-10T06:00:00.000Z");
  assert.equal(r.Biceps.status, "almost");
  assert.equal(r.Cardio, undefined);
  assert.equal(r.Back, undefined); // never trained
});

test("only the latest session counts", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const rows = [
    ...Array.from({ length: 12 }, () => row("old", "2026-10-01T12:00:00Z", "Bench Press")),
    row("new", "2026-10-08T10:00:00Z", "Bench Press"),
  ];
  const r = muscleRecovery(rows, now);
  assert.equal(r.Chest.sets, 1);
  assert.equal(r.Chest.status, "recovering"); // 2 h of 48
});
