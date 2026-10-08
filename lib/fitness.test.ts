import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDaysIso,
  addMonthsIso,
  computeStreak,
  daysBetweenIso,
  isAlreadyLogged,
  phIsoDate,
  weekdayOf,
  weekStartIso,
} from "./fitness.ts";

/** An instant given as wall-clock time in the Philippines (UTC+8, no DST). */
const ph = (local: string) => new Date(`${local}+08:00`);

test("workout at 3 PM on day 1, then rest day early on day 2 is allowed", () => {
  const logged = [phIsoDate(ph("2026-10-07T15:00:00"))];
  assert.deepEqual(logged, ["2026-10-07"]);

  // 1:00 AM PH on 10/8 is still 10/7 in UTC -- the window where the old check failed.
  assert.equal(isAlreadyLogged(logged, ph("2026-10-08T01:00:00")), false);
  // ...and at any other time on 10/8.
  assert.equal(isAlreadyLogged(logged, ph("2026-10-08T09:00:00")), false);
  assert.equal(isAlreadyLogged(logged, ph("2026-10-08T23:59:59")), false);
});

test("a second log on the same PH day is blocked", () => {
  const logged = [phIsoDate(ph("2026-10-08T00:05:00"))];
  assert.equal(isAlreadyLogged(logged, ph("2026-10-08T07:59:00")), true); // UTC still 10/7
  assert.equal(isAlreadyLogged(logged, ph("2026-10-08T16:47:00")), true);
  assert.equal(isAlreadyLogged(logged, ph("2026-10-08T23:59:59")), true);
});

test("11:59 PM and 12:00 AM PH time are two different days", () => {
  assert.equal(phIsoDate(ph("2026-10-08T23:59:00")), "2026-10-08");
  assert.equal(phIsoDate(ph("2026-10-09T00:00:00")), "2026-10-09");

  // Logged at 4:47 PM on 10/8 -> a new log is allowed right at midnight.
  const logged = [phIsoDate(ph("2026-10-08T16:47:00"))];
  assert.equal(isAlreadyLogged(logged, ph("2026-10-08T23:59:00")), true);
  assert.equal(isAlreadyLogged(logged, ph("2026-10-09T00:00:00")), false);
});

test("a log at 12:30 AM PH time lands on the new date", () => {
  const at = ph("2026-10-09T00:30:00");
  assert.equal(at.toISOString().slice(0, 10), "2026-10-08"); // what the UTC-based code used
  assert.equal(phIsoDate(at), "2026-10-09");
});

test("date math is calendar-based", () => {
  assert.equal(addDaysIso("2026-10-01", -1), "2026-09-30");
  assert.equal(addDaysIso("2026-12-31", 1), "2027-01-01");
  assert.equal(addMonthsIso("2026-10-08", -12), "2025-10-08");
  assert.equal(daysBetweenIso("2026-10-07", "2026-10-09"), 2);
  assert.equal(weekStartIso("2026-10-08"), "2026-10-05"); // Thu -> Mon
  assert.equal(weekStartIso("2026-10-11"), "2026-10-05"); // Sun -> previous Mon
  assert.equal(weekStartIso("2026-10-05"), "2026-10-05");
});

test("streak uses the PH date for 'today'", () => {
  const gym = ["2026-10-06", "2026-10-07", "2026-10-08"];
  // 12:30 AM PH on 10/9: today (10/9) not logged yet, streak through yesterday survives.
  assert.equal(computeStreak(gym, ph("2026-10-09T00:30:00")), 3);
  // 1:00 AM PH on 10/8 (UTC 10/7): today's workout counts.
  assert.equal(computeStreak(gym, ph("2026-10-08T01:00:00")), 3);
  // Missed 10/9 entirely -> broken on 10/10.
  assert.equal(computeStreak(gym, ph("2026-10-10T00:30:00")), 0);
});

test("weekday of a PH date", () => {
  assert.equal(weekdayOf("2026-10-08"), 4); // Thursday
  assert.equal(weekdayOf("2026-10-11"), 0); // Sunday
  // 12:30 AM Friday in PH is still Thursday in UTC
  assert.equal(weekdayOf(phIsoDate(ph("2026-10-09T00:30:00"))), 5);
});
