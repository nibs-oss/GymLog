import { levelFor } from "@/lib/levels";

/** Level, XP to the next level, and Push / Pull / Legs / Core stats. */
export function CharacterCard({
  xp,
  workouts,
  stats,
}: {
  xp: number;
  workouts: number;
  stats: { name: string; sets: number; level: number; progress: number }[];
}) {
  const l = levelFor(xp);
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Level</p>
          <p className="text-4xl font-bold tabular-nums text-accent">{l.level}</p>
          <p className="text-sm font-medium text-foreground">{l.title}</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p className="tabular-nums">{xp.toLocaleString()} XP total</p>
          <p>
            {workouts} {workouts === 1 ? "workout" : "workouts"}
          </p>
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(l.progress * 100)}%` }} />
      </div>
      <p className="mt-1 text-xs tabular-nums text-slate-400">
        {l.xpIntoLevel.toLocaleString()} / {l.xpForNext.toLocaleString()} XP to Level {l.level + 1}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3">
        {stats.map((s) => (
          <div key={s.name}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-slate-200">{s.name}</span>
              <span className="tabular-nums text-slate-400">Lv {s.level}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-accent/80" style={{ width: `${Math.round(s.progress * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        XP: 50 per workout, 10 per set, 1 per 100 kg lifted, 50 per new PR. Stats grow with the sets you do for
        each area.
      </p>
    </div>
  );
}
