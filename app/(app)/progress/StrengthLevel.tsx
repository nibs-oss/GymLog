"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { errorMessage } from "@/lib/errors";
import { LEVELS, strengthLevels, type LiftId, type Sex } from "@/lib/strength";
import { formatWeight, type Units } from "@/lib/units";

const LEVEL_COLOR: Record<string, string> = {
  Beginner: "text-slate-400",
  Novice: "text-sky-300",
  Intermediate: "text-accent",
  Advanced: "text-emerald-400",
  Elite: "text-amber-400",
};

/** Big-lift strength level vs bodyweight, with a men's/women's standards switch. */
export default function StrengthLevel({
  best,
  bodyweight,
  initialSex,
  units,
}: {
  best: Partial<Record<LiftId, number>>;
  bodyweight: number | null; // kg, latest entry
  initialSex: Sex | null;
  units: Units;
}) {
  const [sex, setSex] = useState<Sex | null>(initialSex);
  const [error, setError] = useState<string | null>(null);

  const choose = async (next: Sex) => {
    const previous = sex;
    setSex(next);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: saveErr } = user
      ? await supabase.from("user_settings").update({ sex: next }).eq("user_id", user.id).select("user_id")
      : { data: null, error: new Error("Not authenticated") };
    // No settings row yet (Profile never saved): keep the choice for this visit only
    if (saveErr) {
      const msg = errorMessage(saveErr, "Couldn't save.");
      setError(/sex/i.test(msg) ? "The database needs an update first: run the latest supabase/features.sql." : msg);
      setSex(previous);
    } else if (!data?.length) {
      setError("Save your settings on the Profile page once to remember this choice.");
    }
  };

  const levels = sex && bodyweight ? strengthLevels(new Map(Object.entries(best) as [LiftId, number][]), bodyweight, sex) : [];

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">Strength level</h2>
          <p className="text-xs text-slate-500">Estimated 1-rep max vs your bodyweight. A rough guide.</p>
        </div>
        <div className="flex rounded-lg border border-white/10 bg-slate-950 p-1">
          {(
            [
              ["male", "Men's"],
              ["female", "Women's"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => choose(value)}
              aria-pressed={sex === value}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                sex === value ? "bg-accent text-slate-950" : "text-slate-400 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {!bodyweight ? (
        <p className="mt-4 text-sm text-slate-400">
          <Link href="/bodyweight" className="font-medium text-accent hover:underline">
            Log your bodyweight
          </Link>{" "}
          to see your strength level.
        </p>
      ) : !sex ? (
        <p className="mt-4 text-sm text-slate-400">Choose which standards to compare against.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {levels.map((l) => (
            <li key={l.id} className="rounded-xl border border-white/5 bg-slate-950/40 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-foreground">{l.name}</span>
                <span className={`text-sm font-semibold ${l.level ? LEVEL_COLOR[l.level] : "text-slate-500"}`}>
                  {l.level ?? "Not logged yet"}
                </span>
              </div>
              {l.oneRM !== null && l.ratio !== null && (
                <>
                  <p className="mt-1 text-xs tabular-nums text-slate-400">
                    Est. 1RM {formatWeight(l.oneRM, units)} · {l.ratio.toFixed(2)}× bodyweight
                  </p>
                  {/* Level ladder: filled up to the current level, partial toward the next */}
                  <div className="mt-2 flex gap-1" aria-hidden>
                    {LEVELS.map((name, i) => {
                      const current = LEVELS.indexOf(l.level!);
                      const fill = i < current ? 1 : i === current ? (l.next ? l.next.progress : 1) : 0;
                      return (
                        <div key={name} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(fill * 100)}%` }} />
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {l.next
                      ? `${formatWeight(l.next.kgToGo, units)} more on your 1RM for ${l.next.level}`
                      : "Top level 🏆"}
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
