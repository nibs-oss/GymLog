"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { localIsoDate } from "@/lib/fitness";
import { errorMessage } from "@/lib/errors";

export default function RestDayPage() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "done" | "exists">("idle");
  const [error, setError] = useState<string | null>(null);

  const logRest = async () => {
    setState("saving");
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const today = localIsoDate();

      const { data: existing } = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .limit(1);
      if (existing?.length) {
        setState("exists");
        return;
      }

      const { error: insErr } = await supabase
        .from("workout_sessions")
        .insert({ user_id: user.id, routine_id: null, date: today, is_rest_day: true });
      if (insErr) throw insErr;
      setState("done");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "Failed to log rest day."));
      setState("idle");
    }
  };

  return (
    <section className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center">
        <p className="text-4xl">😴</p>
        {state === "done" ? (
          <p className="mt-3 text-slate-300">Rest day logged. Recover well!</p>
        ) : state === "exists" ? (
          <p className="mt-3 text-slate-300">You already logged something for today.</p>
        ) : (
          <>
            <h1 className="mt-3 text-xl font-semibold">Log a rest day?</h1>
            <p className="mt-1 text-sm text-slate-400">Rest days show on your history calendar.</p>
            <button
              onClick={logRest}
              disabled={state === "saving"}
              className="mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-accent/90 disabled:opacity-60"
            >
              {state === "saving" ? "Saving…" : "Log Rest Day"}
            </button>
          </>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <Link href="/" className="mt-4 inline-block text-sm text-slate-400 hover:text-foreground">
          Back to Home
        </Link>
      </div>
    </section>
  );
}
