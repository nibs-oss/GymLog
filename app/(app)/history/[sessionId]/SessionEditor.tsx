"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { WorkoutEditor } from "@/components/workout-editor";
import { phIsoDate, setVolume } from "@/lib/fitness";
import { formatWeight, toDisplay, type Units } from "@/lib/units";
import {
  cleanWorkout,
  clearSessionExercises,
  emptySet,
  newKey,
  saveWorkout,
  type WorkoutExercise,
} from "@/lib/workout";
import { errorMessage } from "@/lib/errors";

interface LoadedExercise {
  name: string;
  muscle_group: string | null;
  sets: { weight: number | null; reps: number | null }[];
}

export default function SessionEditor({
  session,
  routineName,
  exercises,
  units,
  knownNames,
}: {
  session: { id: string; date: string; is_rest_day: boolean };
  routineName: string | null;
  exercises: LoadedExercise[];
  units: Units;
  knownNames: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(session.date);
  const [workout, setWorkout] = useState<WorkoutExercise[]>(() =>
    exercises.map((ex) => ({
      key: `x-${newKey()}`,
      name: ex.name,
      muscle_group: ex.muscle_group,
      sets: ex.sets.length
        ? ex.sets.map((s) =>
            emptySet(
              s.weight !== null ? String(toDisplay(s.weight, units)) : "",
              s.reps !== null ? String(s.reps) : ""
            )
          )
        : [emptySet()],
    }))
  );
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const title = session.is_rest_day ? "Rest Day" : routineName ?? "Workout";
  const totalVolume = exercises.reduce(
    (v, ex) => v + ex.sets.reduce((sv, s) => sv + setVolume(s.weight, s.reps), 0),
    0
  );

  const save = async () => {
    setError(null);
    // The date picker's max isn't enforced when typing, so check here too
    if (!date || date > phIsoDate()) {
      setError("Pick a date that isn't in the future.");
      return;
    }
    const clean = cleanWorkout(workout, units, knownNames);
    if (!session.is_rest_day && !clean.length) {
      setError("A workout needs at least one filled-in set. Delete it instead if it's empty.");
      return;
    }
    setBusy("save");
    try {
      const supabase = createClient();
      if (!session.is_rest_day) {
        await saveWorkout(supabase, { sessionId: session.id, routineId: null, date, exercises: clean });
      } else if (date !== session.date) {
        const { error: dateErr } = await supabase
          .from("workout_sessions")
          .update({ date })
          .eq("id", session.id);
        if (dateErr) throw dateErr;
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "Failed to save changes."));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete this ${session.is_rest_day ? "rest day" : "workout"}? This can't be undone.`)) return;
    setBusy("delete");
    setError(null);
    try {
      const supabase = createClient();
      await clearSessionExercises(supabase, session.id);
      const { data, error: delErr } = await supabase
        .from("workout_sessions")
        .delete()
        .eq("id", session.id)
        .select("id");
      if (delErr) throw delErr;
      if (!data?.length) throw new Error("Could not delete (no permission or already deleted).");
      router.push("/history");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "Failed to delete."));
      setBusy(null);
    }
  };

  return (
    <section className="mx-auto max-w-xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/history" className="text-sm text-slate-400 hover:text-foreground">
            ← History
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-slate-400">
            {new Date(`${session.date}T12:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        {!editing && (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5"
            >
              Edit
            </button>
            <button
              onClick={remove}
              disabled={busy !== null}
              className="rounded-lg px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-60"
            >
              {busy === "delete" ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400">{error}</p>
      )}

      {editing ? (
        <>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <span className="text-sm font-medium text-slate-300">Date</span>
            <input
              type="date"
              max={phIsoDate()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          {!session.is_rest_day && (
            <WorkoutEditor exercises={workout} onChange={setWorkout} units={units} knownNames={knownNames} />
          )}
          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={busy !== null}
              className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-accent/90 disabled:opacity-60"
            >
              {busy === "save" ? "Saving…" : "Save Changes"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              disabled={busy !== null}
              className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </>
      ) : session.is_rest_day ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center text-slate-400">
          😴 Recovery day — no exercises logged.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Exercises", String(exercises.length)],
              ["Sets", String(exercises.reduce((n, ex) => n + ex.sets.length, 0))],
              ["Volume", formatWeight(totalVolume, units)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-center">
                <p className="text-lg font-semibold tabular-nums">{value}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            ))}
          </div>
          {exercises.map((ex, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/progress/${encodeURIComponent(ex.name)}`}
                  className="font-medium text-foreground hover:text-accent"
                >
                  {ex.name}
                </Link>
                {ex.muscle_group && (
                  <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-slate-300">
                    {ex.muscle_group}
                  </span>
                )}
              </div>
              <ol className="mt-2 space-y-1 text-sm text-slate-300">
                {ex.sets.map((s, j) => (
                  <li key={j} className="flex gap-3 tabular-nums">
                    <span className="w-12 text-slate-500">Set {j + 1}</span>
                    <span>
                      {formatWeight(s.weight, units)} × {s.reps ?? "—"}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
