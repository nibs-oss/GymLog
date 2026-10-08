import { createClient as createServerClient } from "@/utils/supabase/server";
import ProfileClient from "./ProfileClient";
import { fetchLoggedSets } from "@/lib/history";
import { characterStats, totalXp } from "@/lib/levels";

/** Server‑side data loader */
async function loadProfileData() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Read the existing settings row (do NOT upsert defaults — that overwrites saved values)
  let { data: settings } = await supabase
    .from("user_settings")
    .select("units, weekly_goal, rest_day_reminders")
    .eq("user_id", user.id)
    .single();

  // Only create a default row if none exists yet
  if (!settings) {
    const { data: inserted } = await supabase
      .from("user_settings")
      .insert({
        user_id: user.id,
        units: "kg",
        weekly_goal: 3,
        rest_day_reminders: false,
      })
      .select("units, weekly_goal, rest_day_reminders")
      .single();
    settings = inserted;
  }

  // Fetch achievements for user (could be empty)
  const { data: achievements } = await supabase
    .from("achievements")
    .select("type, earned_at")
    .eq("user_id", user.id);

  const rows = await fetchLoggedSets(supabase, user.id);
  const { xp, workouts } = totalXp(rows);

  return {
    email: user.email ?? "",
    character: { xp, workouts, stats: characterStats(rows) },
    settings: settings ?? { units: "kg", weekly_goal: 3, rest_day_reminders: false },
    achievements: achievements ?? [],
  };
}

export default async function ProfilePage() {
  const data = await loadProfileData();
  if (!data) {
    return (
      <section className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="rounded-lg border border-white/10 bg-slate-900/60 p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Please log in</h1>
        </div>
      </section>
    );
  }

  return <ProfileClient
      email={data.email}
      initialSettings={data.settings}
      achievements={data.achievements}
      character={data.character}
    />;
}
