"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { TrendChart } from "@/components/charts";
import { addDaysIso, addMonthsIso, phIsoDate } from "@/lib/fitness";
import { formatWeight, toDisplay, toKg, type Units } from "@/lib/units";
import { errorMessage } from "@/lib/errors";

interface Entry {
  id: string;
  date: string;
  weight: number; // kg
}

export default function BodyweightClient({
  entries,
  units,
  setupNeeded,
}: {
  entries: Entry[];
  units: Units;
  setupNeeded: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState(phIsoDate());
  const [weight, setWeight] = useState("");
  const [range, setRange] = useState<"3m" | "1y" | "all">("3m");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chartData = useMemo(() => {
    let from = "";
    if (range !== "all") {
      from = addMonthsIso(phIsoDate(), range === "1y" ? -12 : -3);
    }
    return entries
      .filter((e) => e.date >= from)
      .map((e) => ({ date: e.date, value: toDisplay(e.weight, units) ?? 0 }));
  }, [entries, range, units]);

  const latest = entries[entries.length - 1];
  const monthAgo = (() => {
    const iso = addDaysIso(phIsoDate(), -30);
    return [...entries].reverse().find((e) => e.date <= iso);
  })();
  const change30 = latest && monthAgo ? latest.weight - monthAgo.weight : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const kg = toKg(Number(weight), units);
    if (!kg || kg <= 0) return setError("Enter a valid weight.");
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error: upErr } = await supabase
        .from("body_weights")
        .upsert({ user_id: user.id, date, weight: kg }, { onConflict: "user_id,date" });
      if (upErr) throw upErr;
      setWeight("");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "Failed to save."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    const supabase = createClient();
    const { error: delErr } = await supabase.from("body_weights").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else router.refresh();
  };

  if (setupNeeded) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6">
        <h1 className="text-xl font-semibold">Bodyweight log needs a quick setup</h1>
        <p className="mt-2 text-sm text-slate-400">
          Run <code className="text-slate-200">supabase/features.sql</code> in the Supabase SQL Editor, then refresh
          this page.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Bodyweight</h1>

      <form
        onSubmit={save}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-400">Date</span>
          <input
            type="date"
            value={date}
            max={phIsoDate()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-400">Weight ({units})</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            required
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={latest ? String(toDisplay(latest.weight, units)) : "0"}
            className="w-28 rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 tabular-nums text-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {error && <p className="w-full text-sm text-red-400">{error}</p>}
      </form>

      {entries.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs text-slate-400">Current</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatWeight(latest.weight, units)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs text-slate-400">30-day change</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {change30 === null
                  ? "—"
                  : `${change30 > 0 ? "+" : change30 < 0 ? "−" : ""}${formatWeight(Math.abs(change30), units)}`}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-300">Trend ({units})</p>
              <div className="flex rounded-lg border border-white/10 bg-slate-950 p-1">
                {(
                  [
                    ["3m", "3M"],
                    ["1y", "1Y"],
                    ["all", "All"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setRange(key)}
                    aria-pressed={range === key}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      range === key ? "bg-sky-400/15 text-accent" : "text-slate-400 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <TrendChart data={chartData} unit={units} label="Bodyweight" />
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60">
            <h2 className="border-b border-white/5 px-4 py-3 font-medium">Entries</h2>
            <ul className="divide-y divide-white/5">
              {[...entries].reverse().map((e) => (
                <li key={e.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-400">
                    {new Date(`${e.date}T12:00:00`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium tabular-nums">{formatWeight(e.weight, units)}</span>
                    <button
                      onClick={() => remove(e.id)}
                      aria-label="Delete entry"
                      className="text-xs text-slate-600 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
