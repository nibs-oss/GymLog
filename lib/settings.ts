import type { SupabaseClient } from "@supabase/supabase-js";
import { asUnits, type Units } from "./units";

/** Weekly plan: weekday ("0" = Sunday … "6" = Saturday) -> routine id, or "rest" */
export type WeeklySchedule = Record<string, string>;

export interface UserSettings {
  units: Units;
  weekly_goal: number;
  rest_day_reminders: boolean;
  schedule: WeeklySchedule;
}

export const DEFAULT_SETTINGS: UserSettings = {
  units: "kg",
  weekly_goal: 3,
  rest_day_reminders: false,
  schedule: {},
};

function asSchedule(value: unknown): WeeklySchedule {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([day, v]) => /^[0-6]$/.test(day) && typeof v === "string" && v)
  ) as WeeklySchedule;
}

/** Read settings without creating a row (the Profile page creates it). */
export async function getUserSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<UserSettings> {
  const { data } = await supabase
    .from("user_settings")
    // "*" so columns added by a newer migration don't break older databases
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    units: asUnits(data.units),
    weekly_goal: Number(data.weekly_goal) || DEFAULT_SETTINGS.weekly_goal,
    rest_day_reminders: !!data.rest_day_reminders,
    schedule: asSchedule(data.schedule),
  };
}
