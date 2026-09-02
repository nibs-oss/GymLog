import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month")); // 1-12

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  if (!year || !month) {
    return NextResponse.json({ error: "Missing year or month" }, { status: 400 });
  }

  // Build start and end ISO dates (YYYY-MM-DD)
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // last day of month
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  // Fetch sessions for the user within the month
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, date, is_rest_day, routine_id")
    .eq("user_id", user.id)
    .gte("date", startStr)
    .lte("date", endStr)
    .order("date", { ascending: true });

  // Gather routine names for those sessions (two‑step to avoid join issues)
  const routineIds = (sessions ?? [])
    .filter((s) => s.routine_id)
    .map((s) => s.routine_id);
  const routineMap: Record<string, string> = {};
  if (routineIds.length > 0) {
    const { data: routines } = await supabase
      .from("routines")
      .select("id, name")
      .in("id", routineIds);
    for (const r of routines ?? []) {
      routineMap[r.id] = r.name;
    }
  }

  const result = (sessions ?? []).map((s) => ({
    id: s.id,
    date: s.date,
    is_rest_day: s.is_rest_day,
    routine_name: s.routine_id ? routineMap[s.routine_id] ?? null : null,
  }));

  return NextResponse.json(result);
}
