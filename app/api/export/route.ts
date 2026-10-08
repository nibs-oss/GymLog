import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchLoggedSets } from "@/lib/history";
import { getUserSettings } from "@/lib/settings";
import { estimate1RM, phIsoDate } from "@/lib/fitness";
import { toDisplay } from "@/lib/units";

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const row = (cells: unknown[]) => cells.map(csvCell).join(",");

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const [sets, settings, { data: routines }, { data: weights }] = await Promise.all([
    fetchLoggedSets(supabase, user.id),
    getUserSettings(supabase, user.id),
    supabase.from("routines").select("id, name").eq("user_id", user.id),
    supabase.from("body_weights").select("date, weight").eq("user_id", user.id).order("date"),
  ]);
  const u = settings.units;
  const routineName = new Map((routines ?? []).map((r) => [r.id as string, r.name as string]));

  const lines = [
    row(["date", "routine", "exercise", "muscle_group", "set", `weight_${u}`, "reps", `est_1rm_${u}`]),
    ...sets.map((s) =>
      row([
        s.date,
        s.routineId ? routineName.get(s.routineId) ?? "" : "",
        s.exercise,
        s.muscle ?? "",
        s.setNumber,
        toDisplay(s.weight, u),
        s.reps,
        toDisplay(estimate1RM(s.weight, s.reps), u),
      ])
    ),
  ];

  if (weights?.length) {
    lines.push("", row(["date", `bodyweight_${u}`]));
    for (const w of weights) lines.push(row([w.date, toDisplay(Number(w.weight), u)]));
  }

  // BOM so Excel opens UTF-8 correctly
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gymlog-${phIsoDate()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
