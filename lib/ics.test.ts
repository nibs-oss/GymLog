import { test } from "node:test";
import assert from "node:assert/strict";
import { planCalendar } from "./ics.ts";

const cal = planCalendar(
  [
    { weekday: 0, routineName: "Legs, Glutes; Core" }, // Sunday, needs escaping
    { weekday: 1, routineName: "Push Day" },
  ],
  { token: "tok123", today: "2026-10-08", now: new Date("2026-10-08T12:00:00Z") }
);
const lines = cal.split("\r\n");

test("one weekly all-day event per training day, Monday first", () => {
  assert.equal(lines.filter((l) => l === "BEGIN:VEVENT").length, 2);
  const summaries = lines.filter((l) => l.startsWith("SUMMARY:"));
  assert.deepEqual(summaries, ["SUMMARY:Push Day", "SUMMARY:Legs\\, Glutes\\; Core"]);
  // Current week is Mon Oct 5 – Sun Oct 11
  assert.ok(lines.includes("DTSTART;VALUE=DATE:20261005"));
  assert.ok(lines.includes("DTSTART;VALUE=DATE:20261011"));
  assert.ok(lines.includes("RRULE:FREQ=WEEKLY;BYDAY=MO"));
  assert.ok(lines.includes("RRULE:FREQ=WEEKLY;BYDAY=SU"));
});

test("8:20 PM reminder the evening before", () => {
  assert.equal(lines.filter((l) => l === "TRIGGER:-PT3H40M").length, 2);
  assert.ok(lines.includes("DESCRIPTION:Tomorrow: Push Day"));
});

test("valid calendar wrapper with stable ids and CRLF line endings", () => {
  assert.equal(lines[0], "BEGIN:VCALENDAR");
  assert.equal(lines.at(-2), "END:VCALENDAR");
  assert.ok(cal.endsWith("\r\n"));
  assert.ok(lines.includes("UID:tok123-MO@gymlog"));
  assert.ok(lines.includes("DTSTAMP:20261008T120000Z"));
});

test("an empty plan is still a valid calendar", () => {
  const empty = planCalendar([], { token: "t", today: "2026-10-08", now: new Date() });
  assert.ok(empty.startsWith("BEGIN:VCALENDAR") && empty.includes("END:VCALENDAR"));
  assert.ok(!empty.includes("BEGIN:VEVENT"));
});

test("long lines are folded at 75 octets", () => {
  const long = planCalendar([{ weekday: 2, routineName: "A".repeat(120) }], {
    token: "t",
    today: "2026-10-08",
    now: new Date(),
  });
  for (const line of long.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75);
});
