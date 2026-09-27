"use client";

import { useEffect } from "react";
import { localIsoDate } from "@/lib/fitness";

/** Shows a browser notification (once per day) suggesting a rest day. */
export function RestReminderNotifier({ streak }: { streak: number }) {
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const key = "gymlog.restReminderShown";
    const today = localIsoDate();
    try {
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
    } catch {
      return;
    }
    new Notification("Time for a rest day? 😴", {
      body: `You've trained ${streak} days in a row. Recovery helps you grow stronger.`,
    });
  }, [streak]);
  return null;
}
