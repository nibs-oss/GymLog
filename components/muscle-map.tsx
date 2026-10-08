/**
 * Front/back body figure shaded by sets per muscle group.
 * Shading targets the usual 10–20 hard sets per muscle per week.
 */
type Shape =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number; r: number };

const e = (cx: number, cy: number, rx: number, ry: number): Shape => ({ kind: "ellipse", cx, cy, rx, ry });
const rect = (x: number, y: number, w: number, h: number, r: number): Shape => ({ kind: "rect", x, y, w, h, r });
const pair = (cx: number, cy: number, rx: number, ry: number) => [e(60 - cx, cy, rx, ry), e(60 + cx, cy, rx, ry)];

// Parts not tied to a muscle group (head, forearms, hips, shins) stay neutral
const NEUTRAL = {
  front: [e(60, 20, 13, 15), rect(54, 33, 12, 9, 3), ...pair(42, 126, 6, 15), rect(44, 132, 32, 14, 7), ...pair(10, 222, 7, 21)],
  back: [e(60, 20, 13, 15), rect(54, 33, 12, 9, 3), ...pair(42, 126, 6, 15), ...pair(10, 222, 7, 21)],
};

const MUSCLES: Record<"front" | "back", Record<string, Shape[]>> = {
  front: {
    Shoulders: pair(25, 57, 12, 10),
    Chest: pair(12, 72, 12, 11),
    Biceps: pair(35, 92, 7, 15),
    Core: [rect(47, 86, 26, 44, 9)],
    Quads: pair(11, 172, 11, 29),
  },
  back: {
    Shoulders: pair(25, 57, 12, 10),
    Back: [rect(40, 50, 40, 62, 12)],
    Triceps: pair(35, 92, 7, 15),
    Glutes: pair(10, 138, 11, 12),
    Hamstrings: pair(11, 176, 10, 24),
    Calves: pair(10, 220, 8, 18),
  },
};

/** 0 sets: base colour; then deeper accent up to ~15+ sets */
function opacity(sets: number) {
  if (sets <= 0) return 0;
  return 0.25 + 0.75 * Math.min(1, sets / 15);
}

function ShapeEl({ s, fill, fillOpacity, title }: { s: Shape; fill: string; fillOpacity?: number; title?: string }) {
  const common = { fill, fillOpacity, stroke: "var(--color-slate-700)", strokeWidth: 1 };
  const child = title ? <title>{title}</title> : null;
  return s.kind === "ellipse" ? (
    <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common}>
      {child}
    </ellipse>
  ) : (
    <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} {...common}>
      {child}
    </rect>
  );
}

function Figure({ side, counts }: { side: "front" | "back"; counts: Record<string, number> }) {
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 120 250" className="h-56 w-auto" role="img" aria-label={`Muscles trained, ${side}`}>
        {NEUTRAL[side].map((s, i) => (
          <ShapeEl key={`n${i}`} s={s} fill="var(--color-slate-800)" />
        ))}
        {Object.entries(MUSCLES[side]).map(([muscle, shapes]) => {
          const sets = counts[muscle] ?? 0;
          return shapes.map((s, i) => (
            <g key={`${muscle}${i}`}>
              <ShapeEl s={s} fill="var(--color-slate-800)" />
              {sets > 0 && (
                <ShapeEl s={s} fill="var(--accent)" fillOpacity={opacity(sets)} title={`${muscle}: ${sets} sets`} />
              )}
              {sets === 0 && <ShapeEl s={s} fill="transparent" title={`${muscle}: no sets`} />}
            </g>
          ));
        })}
      </svg>
      <figcaption className="text-[11px] uppercase tracking-wide text-slate-500">{side}</figcaption>
    </figure>
  );
}

export function MuscleMap({ counts }: { counts: Record<string, number> }) {
  const untrained = [...new Set([...Object.keys(MUSCLES.front), ...Object.keys(MUSCLES.back)])].filter(
    (m) => !counts[m]
  );
  return (
    <div>
      <div className="flex justify-center gap-6">
        <Figure side="front" counts={counts} />
        <Figure side="back" counts={counts} />
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-slate-500">
        <span>0</span>
        {[3, 8, 15].map((n) => (
          <span
            key={n}
            className="h-2.5 w-6 rounded-sm"
            style={{ background: "var(--accent)", opacity: opacity(n) }}
          />
        ))}
        <span>15+ sets</span>
      </div>
      {untrained.length > 0 && (
        <p className="mt-2 text-center text-xs text-slate-400">Not trained: {untrained.join(", ")}</p>
      )}
    </div>
  );
}
