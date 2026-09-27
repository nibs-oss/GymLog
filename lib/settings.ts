import type { SupabaseClient } from "@supabase/supabase-js";
import { asUnits, type Units } from "./units";

export interface UserSettings {
  units: Units;
  weekly_goal: number;
  rest_day_reminders: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  units: "kg",
  weekly_goal: 3,
  rest_day_reminders: false,
};

/** Read settings without creating a row (the Profile page creates it). */
export async function getUserSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<UserSettings> {
  const { data } = await supabase
    .from("user_settings")
    .select("units, weekly_goal, rest_day_reminders")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    units: asUnits(data.units),
    weekly_goal: Number(data.weekly_goal) || DEFAULT_SETTINGS.weekly_goal,
    rest_day_reminders: !!data.rest_day_reminders,
  };
}
