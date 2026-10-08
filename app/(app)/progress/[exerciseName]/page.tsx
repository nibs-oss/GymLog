import Link from "next/link";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchLoggedSets } from "@/lib/history";
import { getUserSettings, unitFor } from "@/lib/settings";
import DetailClient from "./DetailClient";

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ exerciseName: string }>;
}) {
  const { exerciseName } = await params;
  const name = decodeURIComponent(exerciseName);

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [rows, settings] = await Promise.all([
    fetchLoggedSets(supabase, user.id, { exercise: name }),
    getUserSettings(supabase, user.id),
  ]);

  return (
    <section className="space-y-4">
      <Link href="/progress" className="inline-block text-sm text-slate-400 hover:text-foreground">
        ← Back to Progress
      </Link>
      <DetailClient
        name={rows.length ? rows[rows.length - 1].exercise : name}
        units={unitFor(name, settings.units, settings.exercise_units)}
        records={rows.map((r) => ({
          sessionId: r.sessionId,
          date: r.date,
          setNumber: r.setNumber,
          weight: r.weight,
          reps: r.reps,
        }))}
      />
    </section>
  );
}
