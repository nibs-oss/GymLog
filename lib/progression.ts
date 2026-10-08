/**
 * Progressive overload ("double progression"):
 * - hit the target reps on every top-weight set last time -> add weight
 * - missed reps -> repeat the weight and aim for the target again
 * - bodyweight moves (no weight logged) -> add a rep once every set hits the target
 * Weights here are in the user's display unit (kg or lbs).
 */
export interface Suggestion {
  weight: number | null;
  reps: number;
  kind: "increase" | "repeat" | "more-reps";
  reason: string;
}

/** Smallest jump people usually make: 2.5 kg plates-pair / 5 lb. */
export const INCREMENT = { kg: 2.5, lbs: 5 } as const;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function suggestNext(
  lastSets: { weight: number | null; reps: number | null }[],
  targetReps: number | null,
  increment: number,
  unitLabel: string
): Suggestion | null {
  if (!targetReps || targetReps <= 0) return null;
  const logged = lastSets.filter((s) => s.weight !== null || s.reps !== null);
  if (!logged.length) return null;

  const weights = logged.map((s) => s.weight).filter((w): w is number => w !== null && w > 0);

  if (!weights.length) {
    const allHit = logged.every((s) => (s.reps ?? 0) >= targetReps);
    return allHit
      ? { weight: null, reps: targetReps + 1, kind: "more-reps", reason: `You hit ${targetReps}+ reps on every set last time` }
      : { weight: null, reps: targetReps, kind: "repeat", reason: `Aim for ${targetReps} reps on every set` };
  }

  const top = Math.max(...weights);
  const topSets = logged.filter((s) => s.weight === top);
  const repsText = topSets.map((s) => s.reps ?? 0).join(", ");
  if (topSets.every((s) => (s.reps ?? 0) >= targetReps)) {
    return {
      weight: round1(top + increment),
      reps: targetReps,
      kind: "increase",
      reason: `You hit all your reps at ${top} ${unitLabel} last time`,
    };
  }
  return {
    weight: top,
    reps: targetReps,
    kind: "repeat",
    reason: `Last time: ${repsText} reps at ${top} ${unitLabel}. Stay there until every set hits ${targetReps}`,
  };
}
