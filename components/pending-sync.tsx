"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  flushPending,
  parsePending,
  pendingSnapshot,
  removePending,
  retryPending,
  subscribePending,
} from "@/lib/pending";

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

/** Uploads workouts finished offline and shows what's still waiting. */
export function PendingSync() {
  const router = useRouter();
  const raw = useSyncExternalStore(subscribePending, pendingSnapshot, () => "[]");
  const pending = useMemo(() => parsePending(raw), [raw]);
  const [uploaded, setUploaded] = useState(0);

  const waiting = pending.filter((w) => !w.error).length;

  // Try whenever something is waiting (on load, when the queue changes, and when back online)
  useEffect(() => {
    if (!waiting || !navigator.onLine) return;
    let cancelled = false;
    flushPending(createClient()).then((n) => {
      if (cancelled || n === 0) return;
      setUploaded(n);
      router.refresh();
      setTimeout(() => setUploaded(0), 4000);
    });
    return () => {
      cancelled = true;
    };
  }, [raw, waiting, router]);

  if (!pending.length && !uploaded) return null;

  return (
    <div className="mb-4 space-y-2">
      {uploaded > 0 && (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-400">
          ✓ Uploaded {uploaded} {uploaded === 1 ? "workout" : "workouts"} saved while offline.
        </p>
      )}
      {waiting > 0 && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-300">
          📶 {waiting} {waiting === 1 ? "workout is" : "workouts are"} saved on this phone and will upload when
          you&apos;re back online. Don&apos;t clear this browser&apos;s data until then.
        </p>
      )}
      {pending
        .filter((w) => w.error)
        .map((w) => (
          <div
            key={w.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm"
          >
            <p className="min-w-0 flex-1 text-red-400">
              Couldn&apos;t upload {w.routineName} ({shortDate(w.date)}): {w.error}
            </p>
            <button
              type="button"
              onClick={() => retryPending(w.id)}
              className="rounded-md px-2 py-1 text-xs font-semibold text-accent hover:bg-sky-400/10"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Discard the ${w.routineName} workout from ${shortDate(w.date)}? This can't be undone.`)) {
                  removePending(w.id);
                }
              }}
              className="rounded-md px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10"
            >
              Discard
            </button>
          </div>
        ))}
    </div>
  );
}
