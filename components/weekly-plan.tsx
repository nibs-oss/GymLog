"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { errorMessage } from "@/lib/errors";
import type { UserSettings, WeeklySchedule } from "@/lib/settings";
import { saveSettingsPatch } from "@/lib/save-settings";

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

  // Calendar subscription (private link, created on first use)
  const [calToken, setCalToken] = useState(settings.calendar_token);
  const [calStatus, setCalStatus] = useState<string | null>(null);
  const feedPath = (token: string) => `${window.location.host}/api/calendar/${token}.ics`;

  const ensureToken = async (fresh = false) => {
    if (calToken && !fresh) return calToken;
    const token = crypto.randomUUID();
    const err = await saveSettingsPatch(createClient(), { calendar_token: token });
    if (err) {
      setCalStatus(err);
      return null;
    }
    setCalToken(token);
    return token;
  };

  const addToCalendar = async () => {
    setCalStatus(null);
    const token = await ensureToken();
    // webcal:// makes iPhone/Mac Calendar offer to subscribe
    if (token) window.location.href = `webcal://${feedPath(token)}`;
  };

  const copyLink = async () => {
    setCalStatus(null);
    const token = await ensureToken();
    if (!token) return;
    try {
      await navigator.clipboard.writeText(`https://${feedPath(token)}`);
      setCalStatus("Link copied. In Google Calendar: Other calendars → From URL.");
    } catch {
      setCalStatus(`https://${feedPath(token)}`);
    }
  };

  const resetLink = async () => {
    if (!confirm("Reset your calendar link? Calendars subscribed with the old link will go empty.")) return;
    setCalStatus(null);
    if (await ensureToken(true)) setCalStatus("New link created. Add it to your calendar again.");
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

      <div className="mt-5 border-t border-white/5 pt-4">
        <p className="text-sm font-medium text-slate-200">Calendar reminders</p>
        <p className="mt-1 text-xs text-slate-500">
          Adds your plan to your phone&apos;s calendar, with a reminder at 8:20 PM the night before each
          training day. Changes here update the calendar automatically. On iPhone, tap Subscribe and turn
          off &ldquo;Remove Alerts&rdquo;.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addToCalendar}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-accent/90"
          >
            Add to Calendar
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium hover:bg-white/5"
          >
            Copy link
          </button>
          {calToken && (
            <button
              type="button"
              onClick={resetLink}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-foreground"
            >
              Reset link
            </button>
          )}
        </div>
        {calStatus && <p className="mt-2 break-all text-xs text-slate-400">{calStatus}</p>}
      </div>
    </div>
  );
}
