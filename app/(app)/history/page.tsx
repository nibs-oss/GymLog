"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth() + 1); // 1-12

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/history?year=${year}&month=${month}`);
      const data = await res.json();
      setSessions(data);
      setLoading(false);
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
  const daysElapsed = Math.min(today.getUTCDate(), days.length);
  const consistencyRaw = Math.round((gymDaysThisMonth / daysElapsed) * 100);
  const consistency = Math.min(consistencyRaw, 100);

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
      <div className="flex flex-col sm:flex-row justify-between rounded-lg border border-white/10 bg-zinc-900/60 p-4 text-center gap-4">
        <div>
          <p className="text-sm text-zinc-400">Gym days this month</p>
          <p className="text-xl font-medium text-foreground">{gymDaysThisMonth}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-400">Consistency</p>
          <p className="text-xl font-medium text-foreground">{consistency}%</p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={prevMonth} className="rounded p-2 text-sm bg-zinc-800 hover:bg-zinc-700">
          &lt; Prev
        </button>
        <span className="text-lg font-medium text-foreground">
          {new Date(Date.UTC(year, month - 1)).toLocaleString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button onClick={nextMonth} className="rounded p-2 text-sm bg-zinc-800 hover:bg-zinc-700">
          Next &gt;
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs sm:text-sm">
        {/* Weekday headers */}
        {"Sun Mon Tue Wed Thu Fri Sat".split(" ").map((day) => (
          <div key={day} className="font-medium text-zinc-400">
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
          const isToday = iso === new Date().toISOString().split("T")[0];
          const bg = session
            ? session.is_rest_day
              ? "bg-zinc-700"
              : "bg-accent"
            : "bg-zinc-800";
          return (
            <div
              key={iso}
              className={`relative rounded p-1 sm:p-2 ${bg} ${isToday ? "border border-white" : ""}`}
            >
              <span className="text-[0.6rem] sm:text-xs text-white/80">{d.getUTCDate()}</span>
              {session && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-black opacity-0 hover:opacity-100 bg-white/90 rounded">
                  <p>{session.is_rest_day ? "Rest Day" : session.routine_name || "Gym"}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
