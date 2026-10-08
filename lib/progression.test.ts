import { test } from "node:test";
import assert from "node:assert/strict";
import { INCREMENT, suggestNext } from "./progression.ts";

const sets = (...pairs: [number | null, number | null][]) => pairs.map(([weight, reps]) => ({ weight, reps }));

test("all target reps hit at the top weight -> add weight", () => {
  const s = suggestNext(sets([60, 8], [60, 8], [60, 9]), 8, INCREMENT.kg, "kg");
  assert.equal(s?.kind, "increase");
  assert.equal(s?.weight, 62.5);
  assert.equal(s?.reps, 8);
});

test("missed reps -> repeat the same weight", () => {
  const s = suggestNext(sets([60, 8], [60, 7], [60, 6]), 8, INCREMENT.kg, "kg");
  assert.equal(s?.kind, "repeat");
  assert.equal(s?.weight, 60);
  assert.match(s!.reason, /8, 7, 6/);
});

test("only the top-weight sets count (warm-ups ignored)", () => {
  const s = suggestNext(sets([40, 5], [60, 8], [60, 8]), 8, INCREMENT.kg, "kg");
  assert.equal(s?.weight, 62.5);
});

test("lbs uses a 5 lb jump", () => {
  assert.equal(suggestNext(sets([135, 10]), 10, INCREMENT.lbs, "lbs")?.weight, 140);
});

test("bodyweight sets add a rep once every set hits the target", () => {
  assert.deepEqual(
    { ...suggestNext(sets([null, 12], [null, 12]), 12, INCREMENT.kg, "kg"), reason: "" },
    { weight: null, reps: 13, kind: "more-reps", reason: "" }
  );
  assert.equal(suggestNext(sets([null, 12], [null, 10]), 12, INCREMENT.kg, "kg")?.kind, "repeat");
});

test("no suggestion without a target or history", () => {
  assert.equal(suggestNext(sets([60, 8]), null, INCREMENT.kg, "kg"), null);
  assert.equal(suggestNext([], 8, INCREMENT.kg, "kg"), null);
  assert.equal(suggestNext(sets([null, null]), 8, INCREMENT.kg, "kg"), null);
});
