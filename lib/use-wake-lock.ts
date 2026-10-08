"use client";

import { useEffect } from "react";

/**
 * Keeps the phone screen on while `active` (Screen Wake Lock API).
 * The browser drops the lock when the tab is hidden, so it's re-taken when
 * the page becomes visible again. Silently does nothing where unsupported.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) next.release();
        else lock = next;
      } catch {
        // Denied (e.g. battery saver): the screen just locks as usual
      }
    };

    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
