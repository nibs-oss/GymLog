/** Readable message from anything thrown (Error, Supabase PostgrestError, string…). */
export function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "string" && err) return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    // Unique index from supabase/repair.sql: one log per user per PH date
    if (typeof m === "string" && m.includes("workout_sessions_user_date_key")) {
      return "You already have a workout or rest day logged on that date.";
    }
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}
