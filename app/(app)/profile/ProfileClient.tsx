"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/utils/supabase/client";
import { LogoutButton } from "@/components/logout-button";
import { ChangePassword } from "@/components/change-password";
import { ACHIEVEMENTS, achievementInfo } from "@/lib/achievements";

type Settings = { units: string; weekly_goal: number; rest_day_reminders: boolean };

function ProfileClient({
  email,
  initialSettings,
  achievements,
}: {
  email: string;
  initialSettings: Settings;
  achievements: { type: string; earned_at: string }[];
}) {
  const router = useRouter();
  const [units, setUnits] = useState(initialSettings.units);
  const [weeklyGoal, setWeeklyGoal] = useState(initialSettings.weekly_goal);
  const [reminders, setReminders] = useState(initialSettings.rest_day_reminders);
  const [saved, setSaved] = useState<Settings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty =
    units !== saved.units ||
    weeklyGoal !== saved.weekly_goal ||
    reminders !== saved.rest_day_reminders;

  const saveSettings = async () => {
    setSaving(true);
    setSaveError(null);
    const supabase = createBrowserClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      setSaveError(userErr?.message ?? "Not authenticated");
      setSaving(false);
      return;
    }
    const next = { units, weekly_goal: weeklyGoal, rest_day_reminders: reminders };
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      setSaveError(error.message ?? "Failed to save settings");
      return;
    }
    setSaved(next);
    router.refresh();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/20 via-sky-400/5 to-transparent p-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-sky-500 text-xl font-bold text-slate-950 shadow-lg shadow-sky-500/20">
          {email.charAt(0).toUpperCase() || "?"}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="truncate text-sm text-slate-400">{email}</p>
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
        <h2 className="mb-2 text-lg font-medium text-foreground">Settings</h2>
        <div className="divide-y divide-white/5">
          {/* Units */}
          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-medium text-slate-200">Units</p>
              <p className="text-xs text-slate-500">Used for logging and progress charts</p>
            </div>
            <div className="flex rounded-lg border border-white/10 bg-slate-950 p-1">
              {["kg", "lbs"].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnits(u)}
                  aria-pressed={units === u}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                    units === u ? "bg-accent text-slate-950" : "text-slate-400 hover:text-foreground"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly goal */}
          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-medium text-slate-200">Weekly goal</p>
              <p className="text-xs text-slate-500">Gym days per week</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeeklyGoal((g) => Math.max(1, g - 1))}
                disabled={weeklyGoal <= 1}
                aria-label="Decrease weekly goal"
                className="h-8 w-8 rounded-lg border border-white/10 bg-slate-950 text-slate-300 hover:border-accent hover:text-accent disabled:opacity-40"
              >
                −
              </button>
              <span className="w-6 text-center text-lg font-semibold tabular-nums text-accent">
                {weeklyGoal}
              </span>
              <button
                type="button"
                onClick={() => setWeeklyGoal((g) => Math.min(7, g + 1))}
                disabled={weeklyGoal >= 7}
                aria-label="Increase weekly goal"
                className="h-8 w-8 rounded-lg border border-white/10 bg-slate-950 text-slate-300 hover:border-accent hover:text-accent disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          {/* Rest day reminders */}
          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-medium text-slate-200">Rest day reminders</p>
              <p className="text-xs text-slate-500">
                Nudge after 3 training days in a row (on Home + browser notification)
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={reminders}
              aria-label="Rest day reminders"
              onClick={async () => {
                const next = !reminders;
                setReminders(next);
                if (next && "Notification" in window && Notification.permission === "default") {
                  await Notification.requestPermission();
                }
              }}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                reminders ? "bg-accent" : "bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  reminders ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveSettings}
            disabled={saving || !dirty}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-slate-950 transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {justSaved && <span className="text-sm text-emerald-400">✓ Saved</span>}
        </div>
        {saveError && <p className="mt-3 text-sm text-red-400">{saveError}</p>}
      </div>

      {/* Achievements */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-medium text-foreground">Achievements</h2>
          <span className="text-sm tabular-nums text-slate-400">
            {achievements.filter((a) => a.type in ACHIEVEMENTS).length}/{Object.keys(ACHIEVEMENTS).length}
          </span>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Object.keys(ACHIEVEMENTS).map((type) => {
            const info = achievementInfo(type);
            const got = achievements.find((a) => a.type === type);
            return (
              <li
                key={type}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  got ? "border-sky-400/25 bg-sky-400/5" : "border-white/5 opacity-50"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
                    got ? "bg-sky-400/15" : "bg-slate-800 grayscale"
                  }`}
                >
                  {got ? info.icon : "🔒"}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{info.title}</p>
                  <p className="text-xs text-slate-400">
                    {got ? `Earned ${new Date(got.earned_at).toLocaleDateString()}` : info.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <ChangePassword email={email} />

      {/* Data */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
        <h2 className="text-lg font-medium text-foreground">Your data</h2>
        <p className="mt-1 text-sm text-slate-400">
          Download every set you&apos;ve logged, plus your bodyweight log, as a spreadsheet (CSV).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/api/export"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/5"
          >
            ⬇ Export CSV
          </a>
          <a
            href="/bodyweight"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/5"
          >
            ⚖ Bodyweight log
          </a>
        </div>
      </div>

      <div className="flex justify-end">
        <LogoutButton />
      </div>
    </section>
  );
}

export default ProfileClient;
