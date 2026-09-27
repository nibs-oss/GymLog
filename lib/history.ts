import type { SupabaseClient } from "@supabase/supabase-js";
import { exerciseKey } from "./exercises";

export interface LoggedSet {
  sessionId: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  routineId: string | null;
  exercise: string;
  muscle: string | null;
  setNumber: number;
  weight: number | null; // kg
  reps: number | null;
}

const CHUNK = 150; // keep `in (...)` filters well under URL length limits

/** Every logged set for the user, oldest first. */
export async function fetchLoggedSets(
  supabase: SupabaseClient,
  userId: string,
  opts: { exercise?: string } = {}
): Promise<LoggedSet[]> {
  const { data: sessions, error: sessErr } = await supabase
    .from("workout_sessions")
    .select("id, date, created_at, routine_id")
    .eq("user_id", userId)
    .eq("is_rest_day", false);
  if (sessErr) throw sessErr;
  if (!sessions?.length) return [];

  const sessionById = new Map(sessions.map((s) => [s.id as string, s]));
  const sessionIds = [...sessionById.keys()];

  const exercises: { id: string; session_id: string; name: string; muscle_group: string | null }[] = [];
  for (let i = 0; i < sessionIds.length; i += CHUNK) {
    const { data, error } = await supabase
      .from("session_exercises")
      .select("id, session_id, name, muscle_group")
      .in("session_id", sessionIds.slice(i, i + CHUNK));
    if (error) throw error;
    exercises.push(...(data ?? []));
  }

  const wanted = opts.exercise ? exerciseKey(opts.exercise) : null;
  const filtered = wanted ? exercises.filter((e) => exerciseKey(e.name) === wanted) : exercises;
  if (!filtered.length) return [];

  const exById = new Map(filtered.map((e) => [e.id, e]));
  const exIds = [...exById.keys()];
  const rows: LoggedSet[] = [];
  for (let i = 0; i < exIds.length; i += CHUNK) {
    const { data, error } = await supabase
      .from("sets")
      .select("session_exercise_id, set_number, weight, reps")
      .in("session_exercise_id", exIds.slice(i, i + CHUNK));
    if (error) throw error;
    for (const s of data ?? []) {
      const ex = exById.get(s.session_exercise_id)!;
      const sess = sessionById.get(ex.session_id)!;
      rows.push({
        sessionId: ex.session_id,
        date: sess.date,
        createdAt: sess.created_at,
        routineId: sess.routine_id,
        exercise: ex.name,
        muscle: ex.muscle_group,
        setNumber: s.set_number,
        weight: s.weight === null ? null : Number(s.weight),
        reps: s.reps === null ? null : Number(s.reps),
      });
    }
  }

  rows.sort((a, b) =>
    a.date === b.date
      ? a.createdAt === b.createdAt
        ? a.setNumber - b.setNumber
        : a.createdAt < b.createdAt ? -1 : 1
      : a.date < b.date ? -1 : 1
  );
  return rows;
}

export interface ExerciseSummary {
  name: string; // most recent spelling
  muscle: string | null;
  bestWeight: number | null; // kg
  lastSets: { setNumber: number; weight: number | null; reps: number | null }[];
  lastDate: string | null;
  sessionCount: number;
}

/** Per-exercise summary keyed by exerciseKey(name). */
export function summariseByExercise(rows: LoggedSet[]): Map<string, ExerciseSummary> {
  const out = new Map<string, ExerciseSummary>();
  const sessionsPerKey = new Map<string, Set<string>>();
  // rows are oldest-first, so later rows overwrite "last" info
  for (const r of rows) {
    const key = exerciseKey(r.exercise);
    let s = out.get(key);
    if (!s) {
      s = { name: r.exercise, muscle: r.muscle, bestWeight: null, lastSets: [], lastDate: null, sessionCount: 0 };
      out.set(key, s);
      sessionsPerKey.set(key, new Set());
    }
    const sessions = sessionsPerKey.get(key)!;
    if (!sessions.has(r.sessionId)) {
      sessions.add(r.sessionId);
      s.lastSets = [];
      s.lastDate = r.date;
      s.name = r.exercise;
      if (r.muscle) s.muscle = r.muscle;
    }
    s.lastSets.push({ setNumber: r.setNumber, weight: r.weight, reps: r.reps });
    if (r.weight !== null && (s.bestWeight === null || r.weight > s.bestWeight)) {
      s.bestWeight = r.weight;
    }
    s.sessionCount = sessions.size;
  }
  return out;
}
