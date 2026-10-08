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

/** Consecutive gym days ending today or yesterday (a streak survives until a day is missed). */
export function computeStreak(gymDates: Iterable<string>, now: Date = new Date()): number {
  const days = new Set(gymDates);
  let cursor = phIsoDate(now);
  if (!days.has(cursor)) cursor = addDaysIso(cursor, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDaysIso(cursor, -1);
  }
  return streak;
}
