/** Estimated one-rep max (Epley). Returns the weight itself for 1-rep sets. */
export function estimate1RM(weight: number | null, reps: number | null): number | null {
  if (!weight || !reps || weight <= 0 || reps <= 0) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Total volume of a set (weight × reps) */
export function setVolume(weight: number | null, reps: number | null): number {
  if (!weight || !reps) return 0;
  return weight * reps;
}

/**
 * A "day" in this app is a calendar date in the Philippines (UTC+8), regardless of
 * where the code runs (UTC server, browser in another zone). Log dates are stored as
 * plain YYYY-MM-DD strings, separate from the created_at timestamp.
 */
export const APP_TIME_ZONE = "Asia/Manila";

const logDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD calendar date in Asia/Manila for the instant `d` (default: now). */
export function phIsoDate(d: Date = new Date()): string {
  return logDateFormat.format(d);
}

/** Shift a YYYY-MM-DD date by whole days (pure calendar math, time-zone independent). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Shift a YYYY-MM-DD date by whole months (overflow rolls forward, like Date#setMonth). */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetweenIso(from: string, to: string): number {
  const ms = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

/** Day of week for a YYYY-MM-DD date: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday of the week containing the YYYY-MM-DD date (default: today in PH). */
export function weekStartIso(iso: string = phIsoDate()): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDaysIso(iso, dow === 0 ? -6 : 1 - dow);
}

/** One log (workout or rest day) per PH calendar date: is `now`'s date already taken? */
export function isAlreadyLogged(logDates: Iterable<string>, now: Date = new Date()): boolean {
  const today = phIsoDate(now);
  for (const d of logDates) if (d === today) return true;
  return false;
}

/** Back-to-back gym days ending today or yesterday (no gaps allowed). */
export function consecutiveDays(gymDates: Iterable<string>, now: Date = new Date()): number {
  const days = new Set(gymDates);
  let cursor = phIsoDate(now);
  if (!days.has(cursor)) cursor = addDaysIso(cursor, -1);
  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = addDaysIso(cursor, -1);
  }
  return count;
}

/**
 * Training streak with a weekly freeze: one missed day per Monday–Sunday
 * week is forgiven automatically; a second miss in the same week ends the
 * streak. Today never breaks it (the day isn't over). `streak` counts
 * training days; `frozen` lists the forgiven days inside the streak.
 */
export function streakInfo(gymDates: Iterable<string>, now: Date = new Date()): { streak: number; frozen: string[] } {
  const days = new Set(gymDates);
  const today = phIsoDate(now);
  const usedWeeks = new Set<string>();
  const frozen: string[] = [];
  let streak = 0;
  let oldestTrained: string | null = null;
  let cursor = days.has(today) ? today : addDaysIso(today, -1);
  if (days.has(today)) {
    streak++;
    oldestTrained = today;
    cursor = addDaysIso(today, -1);
  }
  for (let guard = 0; guard < 3660; guard++) {
    if (days.has(cursor)) {
      streak++;
      oldestTrained = cursor;
    } else {
      const week = weekStartIso(cursor);
      if (usedWeeks.has(week)) break;
      usedWeeks.add(week);
      frozen.push(cursor);
    }
    cursor = addDaysIso(cursor, -1);
  }
  // A freeze only counts if training came before it
  return { streak, frozen: oldestTrained ? frozen.filter((d) => d > oldestTrained!) : [] };
}

/** Training streak (see streakInfo). */
export function computeStreak(gymDates: Iterable<string>, now: Date = new Date()): number {
  return streakInfo(gymDates, now).streak;
}
