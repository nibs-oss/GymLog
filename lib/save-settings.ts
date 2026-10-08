import type { SupabaseClient } from "@supabase/supabase-js";
import { errorMessage } from "./errors";
import { DEFAULT_SETTINGS } from "./settings";

/**
 * Save some settings columns without touching the others. Updates the
 * user's row, or creates it with defaults if they never saved Profile.
 * Returns a readable error, or null on success.
 */
export async function saveSettingsPatch(
  supabase: SupabaseClient,
  patch: Record<string, unknown>
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";
  const { data, error } = await supabase.from("user_settings").update(patch).eq("user_id", user.id).select("user_id");
  if (!error && !data?.length) {
    const { units, weekly_goal, rest_day_reminders } = DEFAULT_SETTINGS;
    const ins = await supabase
      .from("user_settings")
      .insert({ user_id: user.id, units, weekly_goal, rest_day_reminders, ...patch });
    if (ins.error) return errorMessage(ins.error, "Couldn't save.");
    return null;
  }
  if (!error) return null;
  const msg = errorMessage(error, "Couldn't save.");
  // A column from a newer migration is missing
  return /column|schema cache/i.test(msg) ? "The database needs an update first: run the latest supabase/features.sql." : msg;
}
