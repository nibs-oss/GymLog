"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { localIsoDate } from "@/lib/fitness";

interface SessionInfo {
  id: string;
  date: string; // YYYY-MM-DD
  is_rest_day: boolean;
  routine_name: string | null;
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(Date.UTC(year, month - 1, 1));
  while (date.getUTCMonth() === month - 1) {
    days.push(new Date(date));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return days;
}

export default function HistoryPage() {
  const today = new Date();
  const todayIso = localIsoDate(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/history?year=${year}&month=${month}`);
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : []);
      } catch {
        setSessions([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [year, month]);

  const days = getMonthDays(year, month);
  const firstWeekday = days[0].getUTCDay(); // 0=Sun

  // Build a map of date -> session info
  const sessionMap = new Map<string, SessionInfo>();
  sessions.forEach((s) => sessionMap.set(s.date, s));

  // Stats – count distinct gym days
  const gymDaysSet = new Set(
    sessions.filter((s) => !s.is_rest_day).map((s) => s.date)
  );
  const gymDaysThisMonth = gymDaysSet.size;
  // Days of this month that have happened so far (all of them for past months)
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const daysElapsed =
    monthKey < todayIso.slice(0, 7) ? days.length : monthKey > todayIso.slice(0, 7) ? 0 : today.getDate();
  const consistency = daysElapsed ? Math.min(100, Math.round((gymDaysThisMonth / daysElapsed) * 100)) : 0;

  const prevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };
  const nextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  return (
    <section className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">History</h1>

      {/* Stats bar */}
      <div className="flex flex-col sm:flex-row justify-between rounded-lg border border-white/10 bg-slate-900/60 p-4 text-center gap-4">
        <div>
          <p className="text-sm text-slate-400">Gym days</p>
          <p className="text-xl font-medium text-foreground">{gymDaysThisMonth}</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Consistency</p>
          <p className="text-xl font-medium text-foreground">{consistency}%</p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={prevMonth} aria-label="Previous month" className="rounded-lg px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700">
          ‹
        </button>
        <span className={`min-w-44 text-center text-lg font-medium text-foreground ${loading ? "opacity-50" : ""}`}>
          {new Date(Date.UTC(year, month - 1)).toLocaleString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button onClick={nextMonth} aria-label="Next month" className="rounded-lg px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700">
          ›
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs sm:text-sm">
        {/* Weekday headers */}
        {"Sun Mon Tue Wed Thu Fri Sat".split(" ").map((day) => (
          <div key={day} className="font-medium text-slate-400">
            {day}
          </div>
        ))}
        {/* Empty cells before first day */}
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {/* Day cells */}
        {days.map((d) => {
          const iso = d.toISOString().split("T")[0];
          const session = sessionMap.get(iso);
          const isToday = iso === todayIso;
          const bg = session
            ? session.is_rest_day
              ? "bg-slate-600 text-slate-100"
              : "bg-accent text-slate-950 font-semibold"
            : "bg-slate-800/70 text-slate-400";
          const ring = isToday ? "ring-2 ring-white/80 ring-offset-2 ring-offset-background" : "";
          const label = session ? (session.is_rest_day ? "Rest Day" : session.routine_name || "Workout") : "";
          const cls = `flex aspect-square flex-col items-center justify-center rounded-lg p-0.5 ${bg} ${ring}`;
          return session ? (
            <Link key={iso} href={`/history/${session.id}`} title={label} className={`${cls} transition-transform hover:scale-105`}>
              <span className="text-xs sm:text-sm">{d.getUTCDate()}</span>
              <span className="hidden w-full truncate px-0.5 text-[10px] leading-tight sm:block">{label}</span>
            </Link>
          ) : (
            <div key={iso} className={cls}>
              <span className="text-xs sm:text-sm">{d.getUTCDate()}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-accent" /> Workout</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-600" /> Rest day</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-2 ring-white/80" /> Today</span>
        <span>Tap a day to view or edit it.</span>
      </div>
    </section>
  );
}
