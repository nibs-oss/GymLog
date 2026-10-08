import { BODY_BACK, BODY_FRONT, type BodyPart } from "@/lib/body-model";

/**
 * Front/back anatomical figure shaded by sets per muscle group.
 * Shading targets the usual 10–20 hard sets per muscle per week.
 */

/** App muscle group -> body-model parts */
const GROUP_PARTS: Record<string, string[]> = {
  Chest: ["chest"],
  Back: ["trapezius", "upper-back", "lower-back"],
  Shoulders: ["front-deltoids", "back-deltoids"],
  Biceps: ["biceps"],
  Triceps: ["triceps"],
  Core: ["abs", "obliques"],
  Quads: ["quadriceps"],
  Hamstrings: ["hamstring"],
  Glutes: ["gluteal"],
  Calves: ["calves", "left-soleus", "right-soleus"],
};
const GROUP_OF_PART = Object.fromEntries(
  Object.entries(GROUP_PARTS).flatMap(([group, parts]) => parts.map((p) => [p, group]))
);

/** 0 sets: body colour; then deeper accent up to ~15+ sets */
function opacity(sets: number) {
  if (sets <= 0) return 0;
  return 0.3 + 0.7 * Math.min(1, sets / 15);
}

function Figure({ label, parts, counts }: { label: string; parts: BodyPart[]; counts: Record<string, number> }) {
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 100 200" className="h-64 w-auto" role="img" aria-label={`Muscles trained, ${label}`}>
        {parts.map(({ part, polygons }) => {
          const group = GROUP_OF_PART[part];
          const sets = group ? counts[group] ?? 0 : 0;
          const title = group ? `${group}: ${sets ? `${sets} sets` : "no sets"}` : undefined;
          return polygons.map((points, i) => (
            <g key={`${part}${i}`}>
              {/* Gaps between parts (stroke in the page colour) keep each muscle distinct */}
              <polygon
                points={points}
                fill={group ? "var(--color-slate-700)" : "var(--color-slate-800)"}
                stroke="var(--background)"
                strokeWidth={0.6}
                strokeLinejoin="round"
              >
                {title && <title>{title}</title>}
              </polygon>
              {sets > 0 && (
                <polygon points={points} fill="var(--accent)" fillOpacity={opacity(sets)} pointerEvents="none" />
              )}
            </g>
          ));
        })}
      </svg>
      <figcaption className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">{label}</figcaption>
    </figure>
  );
}

export function MuscleMap({ counts }: { counts: Record<string, number> }) {
  const untrained = Object.keys(GROUP_PARTS).filter((g) => !counts[g]);
  return (
    <div>
      <div className="flex justify-center gap-4">
        <Figure label="Front" parts={BODY_FRONT} counts={counts} />
        <Figure label="Back" parts={BODY_BACK} counts={counts} />
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
