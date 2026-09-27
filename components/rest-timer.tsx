"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const PRESETS = [60, 90, 120, 180];
const STORAGE_KEY = "gymlog.restSeconds";
const CHANGE_EVENT = "gymlog:rest-preset";

function readPreset(): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return PRESETS.includes(v) ? v : 90;
  } catch {
    return 90;
  }
}

function writePreset(s: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(s));
  } catch {
    // storage unavailable: preset just won't persist
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribePreset(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Remembered rest length in seconds (90 on the server / first paint). */
function useRestPreset(): number {
  return useSyncExternalStore(subscribePreset, readPreset, () => 90);
}

// iOS only plays Web Audio that was started from a tap, so the context is
// created/resumed on the ✓ tap (primeRestAudio) and reused when time is up.
let audioCtx: AudioContext | null = null;

/** Call from a tap handler (e.g. ticking a set) so the end-of-rest beep can play on iPhone. */
export function primeRestAudio() {
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    // A silent blip fully unlocks audio on older iOS versions
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.01);
  } catch {
    // audio not available
  }
}

function beep() {
  const ctx = audioCtx;
  if (!ctx) return;
  try {
    [0, 0.25, 0.5].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    // audio not available
  }
}

function fmt(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Sticky rest timer. Pass `startedAt` (a Date.now() timestamp) to start a countdown,
 * and `key={startedAt}` so each new set restarts it.
 * Vibrates, beeps and (if the tab is hidden and allowed) notifies when done.
 */
export function RestTimer({ startedAt }: { startedAt: number | null }) {
  const preset = useRestPreset();
  const [endAt, setEndAt] = useState<number | null>(() =>
    startedAt === null ? null : startedAt + readPreset() * 1000
  );
  const [now, setNow] = useState(() => startedAt ?? 0);
  const fired = useRef(false);

  // Tick while running
  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endAt]);

  const remaining = endAt === null ? 0 : (endAt - now) / 1000;
  const running = endAt !== null;
  const done = running && now > 0 && remaining <= 0;

  // Alert once when the countdown finishes, then hide after a moment
  useEffect(() => {
    if (!done || fired.current) return;
    fired.current = true;
    navigator.vibrate?.([200, 100, 200]);
    beep();
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification("Rest over 💪", { body: "Time for your next set." });
    }
    const t = setTimeout(() => setEndAt(null), 3000);
    return () => clearTimeout(t);
  }, [done]);

  const shift = (ms: number) => setEndAt((e) => (e === null ? e : e + ms));

  const choosePreset = (s: number) => {
    writePreset(s);
    if (running) {
      fired.current = false;
      setEndAt(now + s * 1000); // `now` is at most one tick (250ms) old
    }
  };

  const pct = running ? Math.min(100, Math.max(0, (remaining / preset) * 100)) : 0;

  return (
    <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto w-full max-w-xl md:bottom-3">
      <div
        className={`overflow-hidden rounded-2xl border shadow-xl backdrop-blur-md transition-colors ${
          done ? "border-emerald-400/50 bg-emerald-950/80" : "border-sky-400/25 bg-slate-900/90"
        }`}
      >
        {running && (
          <div className="h-1 bg-slate-800">
            <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        )}
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="text-sm text-slate-400">⏱ Rest</span>
          {running ? (
            <>
              <span
                className={`text-2xl font-semibold tabular-nums ${done ? "text-emerald-300" : "text-accent"}`}
                aria-live="polite"
              >
                {done ? "Go!" : fmt(remaining)}
              </span>
              <div className="ml-auto flex gap-1">
                <button
                  type="button"
                  onClick={() => shift(-15000)}
                  className="rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-white/5"
                >
                  −15s
                </button>
                <button
                  type="button"
                  onClick={() => shift(15000)}
                  className="rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-white/5"
                >
                  +15s
                </button>
                <button
                  type="button"
                  onClick={() => setEndAt(null)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-sky-400/10"
                >
                  Skip
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="hidden text-xs text-slate-500 sm:inline">Tick a set to start</span>
              <div className="ml-auto flex gap-1">
                {PRESETS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => choosePreset(s)}
                    aria-pressed={preset === s}
                    className={`rounded-lg px-2 py-1 text-xs tabular-nums ${
                      preset === s ? "bg-sky-400/15 text-accent" : "text-slate-400 hover:bg-white/5"
                    }`}
                  >
                    {fmt(s)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
