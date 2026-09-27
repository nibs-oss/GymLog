// Weights are always stored in kg; convert only at the edges (input/display).

export type Units = "kg" | "lbs";

const LBS_PER_KG = 2.20462;

export function asUnits(value: unknown): Units {
  return value === "lbs" ? "lbs" : "kg";
}

/** kg (stored) -> number in the user's unit, rounded to 0.1 */
export function toDisplay(kg: number | null | undefined, units: Units): number | null {
  if (kg === null || kg === undefined || Number.isNaN(Number(kg))) return null;
  const v = units === "lbs" ? Number(kg) * LBS_PER_KG : Number(kg);
  return Math.round(v * 10) / 10;
}

/** number typed in the user's unit -> kg for storage */
export function toKg(value: number | null | undefined, units: Units): number | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const kg = units === "lbs" ? Number(value) / LBS_PER_KG : Number(value);
  return Math.round(kg * 1000) / 1000;
}

/** "80 kg" / "176.4 lbs" / "—" */
export function formatWeight(kg: number | null | undefined, units: Units): string {
  const v = toDisplay(kg, units);
  return v === null ? "—" : `${v.toLocaleString()} ${units}`;
}
