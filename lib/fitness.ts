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

/** YYYY-MM-DD in the viewer's local time zone (not UTC). */
export function localIsoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday of the week containing `d`, as YYYY-MM-DD */
export function weekStartIso(d: Date = new Date()): string {
  const copy = new Date(d);
  const dow = copy.getDay();
  copy.setDate(copy.getDate() + (dow === 0 ? -6 : 1 - dow));
  return localIsoDate(copy);
}

/** Consecutive gym days ending today or yesterday (a streak survives until a day is missed). */
export function computeStreak(gymDates: Iterable<string>, today: Date = new Date()): number {
  const days = new Set(gymDates);
  const cursor = new Date(today);
  cursor.setHours(12, 0, 0, 0);
  if (!days.has(localIsoDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localIsoDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
