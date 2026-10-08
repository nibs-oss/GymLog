"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { errorMessage } from "@/lib/errors";
import type { UserSettings, WeeklySchedule } from "@/lib/settings";

/** Monday-first, values are JS weekdays (0 = Sunday) */
export const PLAN_DAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;

/** Pick a routine (or rest) for each weekday; saves as soon as it changes. */
export function WeeklyPlan({
  routines,
  settings,
}: {
  routines: { id: string; name: string }[];
  settings: UserSettings;
}) {
  const router = useRouter();
  const [schedule, setSchedule] = useState<WeeklySchedule>(settings.schedule);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const change = async (day: number, value: string) => {
    const next = { ...schedule };
    if (value) next[day] = value;
    else delete next[day];
    const previous = schedule;
    setSchedule(next);
    setStatus("saving");
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error: saveErr } = user
      ? await supabase.from("user_settings").upsert(
          {
            user_id: user.id,
            units: settings.units,
            weekly_goal: settings.weekly_goal,
            rest_day_reminders: settings.rest_day_reminders,
            schedule: next,
          },
          { onConflict: "user_id" }
        )
      : { error: new Error("Not authenticated") };

    if (saveErr) {
      setSchedule(previous);
      setStatus("idle");
      const msg = errorMessage(saveErr, "Couldn't save your plan.");
      setError(
        /schedule/i.test(msg) ? "The database needs an update first: run the latest supabase/features.sql." : msg
      );
      return;
    }
    setStatus("saved");
    router.refresh();
    setTimeout(() => setStatus("idle"), 1500);
  };

  const planned = PLAN_DAYS.filter(([d]) => schedule[d] && schedule[d] !== "rest").length;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium text-foreground">Weekly plan</h2>
        <span className="text-xs text-slate-500">
          {status === "saving" ? "Saving…" : status === "saved" ? "✓ Saved" : `${planned} training ${planned === 1 ? "day" : "days"}`}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-400">Home shows what&apos;s planned for today.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {PLAN_DAYS.map(([day, label]) => (
          <label key={day} className="flex items-center gap-3">
            <span className="w-10 text-sm font-medium text-slate-300">{label}</span>
            <select
              value={schedule[day] ?? ""}
              onChange={(e) => change(day, e.target.value)}
              disabled={status === "saving"}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-sm text-foreground disabled:opacity-60"
            >
              <option value="">Nothing planned</option>
              <option value="rest">Rest day</option>
              {routines.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
              {/* A deleted routine still in the plan: show it so it can be changed */}
              {schedule[day] && schedule[day] !== "rest" && !routines.some((r) => r.id === schedule[day]) && (
                <option value={schedule[day]}>Deleted routine</option>
              )}
            </select>
          </label>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
