import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHeatmap } from "./heatmap.ts";

test("53 Monday-first weeks ending with the current week", () => {
  const { weeks } = buildHeatmap(new Map(), new Set(), "2026-10-08");
  assert.equal(weeks.length, 53);
  assert.ok(weeks.every((w) => w.length === 7));
  const last = weeks[52];
  assert.equal(last[0].date, "2026-10-05"); // Monday of this week
  assert.equal(last[3].date, "2026-10-08");
  assert.equal(last[3].future, false);
  assert.equal(last[4].future, true);
});

test("volume quartiles set the shade; bodyweight-only days still show", () => {
  const vol = new Map([
    ["2026-10-01", 1000],
    ["2026-10-02", 2000],
    ["2026-10-03", 3000],
    ["2026-10-06", 4000],
    ["2026-10-07", 0], // bodyweight only
  ]);
  const { weeks } = buildHeatmap(vol, new Set(["2026-10-04"]), "2026-10-08");
  const cells = new Map(weeks.flat().map((c) => [c.date, c]));
  assert.equal(cells.get("2026-10-01")!.level, 1);
  assert.equal(cells.get("2026-10-06")!.level, 4);
  assert.equal(cells.get("2026-10-07")!.level, 1);
  assert.equal(cells.get("2026-10-05")!.level, 0);
  assert.equal(cells.get("2026-10-04")!.rest, true);
});

test("month labels are spaced out", () => {
  const { months } = buildHeatmap(new Map(), new Set(), "2026-10-08");
  assert.ok(months.length >= 12 && months.length <= 14);
  for (let i = 1; i < months.length; i++) assert.ok(months[i].week - months[i - 1].week >= 3);
});
