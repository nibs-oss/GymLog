import type { SupabaseClient } from "@supabase/supabase-js";
import { computeStreak, weekStartIso } from "./fitness";

/** Achievement ids are stored in achievements.type. */
export const ACHIEVEMENTS: Record<string, { title: string; description: string; icon: string }> = {
  first_workout: { title: "First Workout", description: "Logged your first workout", icon: "🎯" },
  workouts_10: { title: "10 Workouts", description: "Logged 10 workouts", icon: "💪" },
  workouts_25: { title: "25 Workouts", description: "Logged 25 workouts", icon: "🏋️" },
  workouts_50: { title: "50 Workouts", description: "Logged 50 workouts", icon: "🥈" },
  workouts_100: { title: "100 Workouts", description: "Logged 100 workouts", icon: "🥇" },
  streak_3: { title: "3-Day Streak", description: "Trained 3 days in a row", icon: "🔥" },
  streak_7: { title: "7-Day Streak", description: "Trained 7 days in a row", icon: "⚡" },
  weekly_goal: { title: "Goal Crusher", description: "Hit your weekly gym goal", icon: "✅" },
  first_pr: { title: "Personal Best", description: "Set a new personal record", icon: "🏆" },
};

export function achievementInfo(type: string) {
  return ACHIEVEMENTS[type] ?? { title: type, description: "", icon: "🏅" };
}

/**
 * Check which achievements the user now qualifies for and store new ones.
 * `prCount` is the number of PRs set in the workout that was just saved.
 * Returns the ids that were newly earned.
 */
export async function awardAchievements(
  supabase: SupabaseClient,
  userId: string,
  opts: { prCount?: number; weeklyGoal?: number } = {}
): Promise<string[]> {
  const [{ data: sessions }, { data: existing }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("date")
      .eq("user_id", userId)
      .eq("is_rest_day", false),
    supabase.from("achievements").select("type").eq("user_id", userId),
  ]);

  const have = new Set((existing ?? []).map((a) => a.type as string));
  const dates = (sessions ?? []).map((s) => s.date as string);
  const total = dates.length;
  const streak = computeStreak(dates);
  const weekStart = weekStartIso();
  const thisWeek = new Set(dates.filter((d) => d >= weekStart)).size;

  const earned: string[] = [];
  if (total >= 1) earned.push("first_workout");
  if (total >= 10) earned.push("workouts_10");
  if (total >= 25) earned.push("workouts_25");
  if (total >= 50) earned.push("workouts_50");
  if (total >= 100) earned.push("workouts_100");
  if (streak >= 3) earned.push("streak_3");
  if (streak >= 7) earned.push("streak_7");
  if (opts.weeklyGoal && thisWeek >= opts.weeklyGoal) earned.push("weekly_goal");
  if ((opts.prCount ?? 0) > 0) earned.push("first_pr");

  const fresh = earned.filter((t) => !have.has(t));
  if (fresh.length === 0) return [];

  const now = new Date().toISOString();
  const { error } = await supabase.from("achievements").upsert(
    fresh.map((type) => ({ user_id: userId, type, earned_at: now })),
    { onConflict: "user_id,type", ignoreDuplicates: true }
  );
  if (error) {
    console.error("Failed to save achievements:", error.message);
    return [];
  }
  return fresh;
}
