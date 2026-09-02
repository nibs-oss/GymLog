"use client";

import { useState } from "react";
import { createClient as createBrowserClient } from "@/utils/supabase/client";
import { LogoutButton } from "@/components/logout-button";

function ProfileClient({
  email,
  initialSettings,
  achievements,
}: {
  email: string;
  initialSettings: { units: string; weekly_goal: number; rest_day_reminders: boolean };
  achievements: { type: string; earned_at: string }[];
}) {
  const [units, setUnits] = useState(initialSettings.units);
  const [weeklyGoal, setWeeklyGoal] = useState(initialSettings.weekly_goal);
  const [reminders, setReminders] = useState(initialSettings.rest_day_reminders);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const supabase = createBrowserClient();

  const saveSettings = async () => {
    setSaving(true);
    setSaveError(null);
    console.log("Saving settings payload:", { units, weekly_goal: weeklyGoal, rest_day_reminders: reminders });
    // Get current user id for upsert
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      console.error("Failed to get user:", userErr);
      setSaveError(userErr.message ?? "Failed to get user");
      setSaving(false);
      return;
    }
    if (!user) {
      console.error("No authenticated user");
      setSaveError("Not authenticated");
      setSaving(false);
      return;
    }
    const payload = {
      user_id: user.id,
      units,
      weekly_goal: weeklyGoal,
      rest_day_reminders: reminders,
    };
    console.log("Upserting with payload:", payload);
    const { data, error } = await supabase
      .from("user_settings")
      .upsert(payload, { onConflict: "user_id" })
      .select();
    console.log("Supabase upsert response data:", data, "error:", error);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setSaveError(error.message ?? "Failed to save settings");
      console.error("Error updating settings:", error);
    }
  };

  return (
    <section className="space-y-8 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="text-sm text-zinc-400">Logged in as: {email}</p>

      {/* Settings form */}
      <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-6">
        <h2 className="text-lg font-medium text-foreground mb-4">Settings</h2>
        <div className="flex flex-col gap-4">
          {/* Units toggle */}
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-300">Units</span>
            <select
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              className="rounded border border-white/10 bg-zinc-950 px-2 py-1 text-sm text-foreground w-full sm:w-auto"
            >
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
            </select>
          </label>
          {/* Weekly goal */}
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-300">Weekly Goal (gym days)</span>
            <input
              type="number"
              min={0}
              value={weeklyGoal}
              onChange={(e) => setWeeklyGoal(Number(e.target.value))}
              className="w-20 rounded border border-white/10 bg-zinc-950 px-2 py-1 text-sm text-foreground"
            />
          </label>
          {/* Rest day reminders */}
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-300">Rest Day Reminders</span>
            <input
              type="checkbox"
              checked={reminders}
              onChange={(e) => setReminders(e.target.checked)}
              className="h-4 w-4 rounded border-white/10 bg-zinc-800 text-accent focus:ring-accent"
            />
          </label>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="mt-2 self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent/90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className="ml-2 text-sm text-green-400">Saved</span>}
          {saveError && <p className="mt-2 text-sm text-red-400">{saveError}</p>}
        </div>
      </div>

      {/* Achievements */}
      <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-6">
        <h2 className="text-lg font-medium text-foreground mb-4">Achievements</h2>
        {achievements.length === 0 ? (
          <p className="text-sm text-zinc-400">No achievements yet — keep logging workouts!</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {achievements.map((a, idx) => (
              <li key={idx} className="rounded border border-white/10 bg-zinc-800 p-4">
                <p className="font-medium text-foreground">{a.type}</p>
                <p className="text-sm text-zinc-300">Earned: {new Date(a.earned_at).toLocaleDateString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Logout button */}
      <div className="flex justify-end">
        <LogoutButton />
      </div>
    </section>
  );
}

export default ProfileClient;
