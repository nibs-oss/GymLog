import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchLoggedSets } from "@/lib/history";
import { getUserSettings } from "@/lib/settings";
import { computeStreak, setVolume } from "@/lib/fitness";
import { exerciseKey } from "@/lib/exercises";
import { newWeightPRs } from "@/lib/records";
import { formatWeight, toDisplay, type Units } from "@/lib/units";

import { workoutCard } from "@/lib/share-card";

/** Story-sized PNG summary of one of the user's workouts, for sharing. */
function bestSetText(sets: { weight: number | null; reps: number | null }[], units: Units) {
  const weighted = sets.filter((s) => s.weight !== null && s.weight > 0);
  if (weighted.length) {
    const top = weighted.reduce((a, b) =>
      b.weight! > a.weight! || (b.weight === a.weight && (b.reps ?? 0) > (a.reps ?? 0)) ? b : a
    );
    return `${toDisplay(top.weight, units)} ${units} × ${top.reps ?? "–"}`;
  }
  const reps = Math.max(0, ...sets.map((s) => s.reps ?? 0));
  return reps ? `${reps} reps` : "–";
}

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthenticated", { status: 401 });

  // Row-level security limits this to the user's own workouts
  const [{ data: session }, rows, settings] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, date, is_rest_day, routines(name)")
      .eq("id", sessionId)
      .maybeSingle(),
    fetchLoggedSets(supabase, user.id),
    getUserSettings(supabase, user.id),
  ]);
  if (!session || session.is_rest_day) return new Response("Not found", { status: 404 });

  const units = settings.units;
  const date = session.date as string;
  const routineName = (session.routines as unknown as { name: string } | null)?.name ?? "Workout";
  const sets = rows.filter((r) => r.sessionId === sessionId);

  const byExercise = new Map<string, { name: string; sets: typeof sets }>();
  for (const s of sets) {
    const key = exerciseKey(s.exercise);
    if (!byExercise.has(key)) byExercise.set(key, { name: s.exercise, sets: [] });
    byExercise.get(key)!.sets.push(s);
  }
  const exercises = [...byExercise.values()];
  const volume = sets.reduce((v, s) => v + setVolume(s.weight, s.reps), 0);
  const prs = new Set(newWeightPRs(rows, date, date).map(exerciseKey));
  // Streak as of that workout (one log per PH day, so noon PH that day is safe)
  const streak = computeStreak(
    new Set(rows.map((r) => r.date)),
    new Date(`${date}T12:00:00+08:00`)
  );

  return workoutCard(
    {
      date,
      routineName,
      volume: formatWeight(volume, units),
      sets: sets.length,
      streak,
      prCount: prs.size,
      exercises: exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets.length,
        best: bestSetText(ex.sets, units),
        pr: prs.has(exerciseKey(ex.name)),
      })),
    },
    { "Cache-Control": "private, no-store" }
  );
}
