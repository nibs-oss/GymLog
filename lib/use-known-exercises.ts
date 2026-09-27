"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

/** The user's own exercise names (RLS limits these to their rows), most used first. */
export function useKnownExercises(): string[] {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    Promise.all([
      supabase.from("routine_exercises").select("name"),
      supabase.from("session_exercises").select("name"),
    ]).then(([a, b]) => {
      if (cancelled) return;
      const counts = new Map<string, number>();
      for (const row of [...(a.data ?? []), ...(b.data ?? [])]) {
        const n = String(row.name ?? "").trim();
        if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
      }
      setNames([...counts.entries()].sort((x, y) => y[1] - x[1]).map(([n]) => n));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return names;
}
