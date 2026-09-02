import { createClient as createServerClient } from "@/utils/supabase/server";
import Link from "next/link";

export default async function RestDayPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <section className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Please log in</h1>
        </div>
      </section>
    );
  }

  // Check for existing entry today
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", today)
    .single();

  if (existing) {
    return (
      <section className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-8 text-center">
          <p className="text-zinc-400">You have already logged a session for today.</p>
          <Link href="/" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent/90">
            Back to Home
          </Link>
        </div>
      </section>
    );
  }

  // Create rest day session
  const { error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      routine_id: null,
      date: today,
      is_rest_day: true,
    })
    .single();

  return (
    <section className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-8 text-center">
        <p className="text-zinc-400">Rest day logged for today.</p>
        <Link href="/" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent/90">
          Back to Home
        </Link>
      </div>
    </section>
  );
}
