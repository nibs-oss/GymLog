import { createClient as createServerClient } from "@/utils/supabase/server";
import DetailClient from "./DetailClient";
import Link from "next/link";

interface SetRecord {
  date: string; // YYYY-MM-DD
  weight: number;
  reps: number;
  set_number: number;
}

interface ExerciseData {
  records: SetRecord[];
  pb: number;
}

/** Fetch all sets for a given exercise name for the logged-in user */
async function fetchExerciseData(name: string): Promise<ExerciseData | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Step 1: fetch session_exercises for this exercise name and user
  const { data: sesEx } = await supabase
    .from("session_exercises")
    .select("id, workout_sessions!inner(date, user_id)")
    .eq("name", name)
    .eq("workout_sessions.user_id", user.id);

  if (!sesEx || sesEx.length === 0) {
    return { records: [], pb: 0 };
  }

  const sesIds = (sesEx as any[]).map((row) => row.id);

  // Step 2: fetch sets for those session_exercise ids
  const { data: setRows } = await supabase
    .from("sets")
    .select("weight, reps, set_number, session_exercise_id")
    .in("session_exercise_id", sesIds);

  if (!setRows) return { records: [], pb: 0 };

  // Map session_exercise_id to date using sesEx data
  const dateMap: Record<string, string> = {};
  for (const row of sesEx as any[]) {
    const date = row.workout_sessions?.date;
    if (date) dateMap[row.id] = date;
  }

  const records: SetRecord[] = (setRows as any[]).map((s) => ({
    date: dateMap[s.session_exercise_id] || "",
    weight: s.weight,
    reps: s.reps,
    set_number: s.set_number,
  }));

  // Sort by date ascending
  records.sort((a, b) => (a.date < b.date ? -1 : 1));

  // Compute PB (max weight)
  const pb = records.reduce((max, rec) => (rec.weight > max ? rec.weight : max), 0);

  return { records, pb };
}

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ exerciseName: string }>;
}) {
  const { exerciseName } = await params;
  const decodedName = decodeURIComponent(exerciseName);
  const data = await fetchExerciseData(decodedName);

  if (!data) {
    return (
      <section className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Exercise not found</h1>
          <Link href="/progress" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent/90">
            Back to Progress
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 p-4">
      {/* Back link */}
      <Link href="/progress" className="inline-block mb-2 text-sm text-zinc-400 hover:underline">
        ← Back to Progress
      </Link>
      <DetailClient name={decodedName} records={data.records} pb={data.pb} />
    </section>
  );
}
