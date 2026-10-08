import { BODY_BACK, BODY_FRONT, type BodyPart } from "@/lib/body-model";
import type { RecoveryStatus } from "@/lib/recovery";

/**
 * Front/back anatomical figure, either shaded by sets per muscle group
 * (targets the usual 10–20 hard sets per week) or, with `recovery`, coloured
 * by how recovered each muscle is.
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

export const RECOVERY_COLOR: Record<RecoveryStatus, string> = {
  recovering: "var(--color-red-400)",
  almost: "var(--color-amber-400)",
  fresh: "var(--color-emerald-400)",
};
export const RECOVERY_LABEL: Record<RecoveryStatus, string> = {
  recovering: "Recovering",
  almost: "Almost ready",
  fresh: "Fresh",
};

type Paint = (group: string) => { fill: string; opacity: number; title: string };

function Figure({ label, parts, paint }: { label: string; parts: BodyPart[]; paint: Paint }) {
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 100 200" className="h-64 w-auto" role="img" aria-label={`Muscles trained, ${label}`}>
        {parts.map(({ part, polygons }) => {
          const group = GROUP_OF_PART[part];
          const p = group ? paint(group) : null;
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
                {p && <title>{p.title}</title>}
              </polygon>
              {p && p.opacity > 0 && (
                <polygon points={points} fill={p.fill} fillOpacity={p.opacity} pointerEvents="none" />
              )}
            </g>
          ));
        })}
      </svg>
      <figcaption className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">{label}</figcaption>
    </figure>
  );
}

export function MuscleMap({
  counts = {},
  recovery,
}: {
  counts?: Record<string, number>;
  /** Status per muscle group; groups not listed haven't been trained, so they're fresh */
  recovery?: Record<string, RecoveryStatus>;
}) {
  const paint: Paint = recovery
    ? (group) => {
        const status = recovery[group] ?? "fresh";
        return { fill: RECOVERY_COLOR[status], opacity: 0.85, title: `${group}: ${RECOVERY_LABEL[status]}` };
      }
    : (group) => {
        const sets = counts[group] ?? 0;
        return { fill: "var(--accent)", opacity: opacity(sets), title: `${group}: ${sets ? `${sets} sets` : "no sets"}` };
      };

  const figures = (
    <div className="flex justify-center gap-4">
      <Figure label="Front" parts={BODY_FRONT} paint={paint} />
      <Figure label="Back" parts={BODY_BACK} paint={paint} />
    </div>
  );

  if (recovery) {
    return (
      <div>
        {figures}
        <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-slate-500">
          {(["recovering", "almost", "fresh"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: RECOVERY_COLOR[s], opacity: 0.85 }} />
              {RECOVERY_LABEL[s]}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const untrained = Object.keys(GROUP_PARTS).filter((g) => !counts[g]);
  return (
    <div>
      {figures}
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
