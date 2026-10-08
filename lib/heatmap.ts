import { addDaysIso, weekStartIso } from "./fitness.ts";

export interface HeatCell {
  date: string; // YYYY-MM-DD (PH)
  level: 0 | 1 | 2 | 3 | 4; // 0 = no workout; 1–4 = volume quartile
  volume: number; // kg
  rest: boolean; // a logged rest day
  future: boolean; // after today (cell left blank)
}

/**
 * Year grid (Monday-first weeks, oldest week first) of training days shaded
 * by volume. A workout always gets at least level 1, even bodyweight-only.
 */
export function buildHeatmap(
  volumeByDate: Map<string, number>, // every gym day, volume may be 0
  restDates: Set<string>,
  today: string,
  weeks = 53
): { weeks: HeatCell[][]; months: { week: number; label: string }[] } {
  const volumes = [...volumeByDate.values()].filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p: number) => volumes[Math.floor(p * (volumes.length - 1))] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const levelOf = (date: string): HeatCell["level"] => {
    if (!volumeByDate.has(date)) return 0;
    const v = volumeByDate.get(date)!;
    if (v <= cuts[0]) return 1;
    if (v <= cuts[1]) return 2;
    if (v <= cuts[2]) return 3;
    return 4;
  };

  const start = addDaysIso(weekStartIso(today), -7 * (weeks - 1));
  const grid: HeatCell[][] = [];
  const months: { week: number; label: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDaysIso(start, w * 7 + d);
      col.push({
        date,
        level: levelOf(date),
        volume: volumeByDate.get(date) ?? 0,
        rest: restDates.has(date),
        future: date > today,
      });
    }
    // Label a column when a new month starts within it
    const firstOfMonth = col.find((c) => c.date.endsWith("-01"));
    if (firstOfMonth || w === 0) {
      const ref = firstOfMonth?.date ?? col[0].date;
      const label = new Date(`${ref}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
      if (!months.length || w - months[months.length - 1].week >= 3) months.push({ week: w, label });
    }
    grid.push(col);
  }
  return { weeks: grid, months };
}
