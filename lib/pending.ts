import type { SupabaseClient } from "@supabase/supabase-js";
import { errorMessage } from "./errors";
import { saveWorkout, type CleanExercise } from "./workout";

/**
 * Workouts finished without a connection, kept on this device until they
 * upload. Each keeps the PH date it was finished on, so a late upload never
 * shifts it to another day.
 */
export interface PendingWorkout {
  id: string;
  routineId: string | null;
  routineName: string;
  date: string; // YYYY-MM-DD (PH)
  exercises: CleanExercise[];
  queuedAt: number;
  error?: string; // why the last upload attempt was refused (not network)
}

const KEY = "gymlog.pendingWorkouts";
export const PENDING_EVENT = "gymlog:pending-changed";

/** Raw stored value; stable between changes so it works with useSyncExternalStore. */
export function pendingSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function parsePending(raw: string): PendingWorkout[] {
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function loadPending(): PendingWorkout[] {
  return parsePending(pendingSnapshot());
}

function store(list: PendingWorkout[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing more we can do on this device
  }
  window.dispatchEvent(new Event(PENDING_EVENT));
}

export function subscribePending(cb: () => void) {
  window.addEventListener(PENDING_EVENT, cb);
  window.addEventListener("storage", cb);
  window.addEventListener("online", cb);
  return () => {
    window.removeEventListener(PENDING_EVENT, cb);
    window.removeEventListener("storage", cb);
    window.removeEventListener("online", cb);
  };
}

export function addPending(w: Omit<PendingWorkout, "id" | "queuedAt">) {
  store([...loadPending(), { ...w, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, queuedAt: Date.now() }]);
}

export function removePending(id: string) {
  store(loadPending().filter((w) => w.id !== id));
}

/** True when a failure was the connection, not the server refusing the data. */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
  if (name === "AuthRetryableFetchError") return true;
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(
    errorMessage(err, "")
  );
}

let flushing = false;

/**
 * Upload queued workouts, oldest first. Stops at the first connection error
 * (try again later); a refusal (e.g. that day already has a log) is recorded
 * on the item so the user can decide what to do with it.
 */
export async function flushPending(supabase: SupabaseClient): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let uploaded = 0;
  try {
    for (const w of loadPending()) {
      if (w.error) continue; // waiting for the user to retry or discard
      try {
        await saveWorkout(supabase, {
          sessionId: null,
          routineId: w.routineId,
          date: w.date,
          exercises: w.exercises,
        });
        removePending(w.id);
        uploaded++;
      } catch (err) {
        if (isNetworkError(err)) break;
        store(loadPending().map((p) => (p.id === w.id ? { ...p, error: errorMessage(err, "Upload failed.") } : p)));
      }
    }
  } finally {
    flushing = false;
  }
  return uploaded;
}

/** Clear a refusal so the next flush tries the item again. */
export function retryPending(id: string) {
  store(loadPending().map((p) => (p.id === id ? { ...p, error: undefined } : p)));
}
