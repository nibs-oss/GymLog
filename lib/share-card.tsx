import { ImageResponse } from "next/og";

// Story-sized (9:16) workout summary image (GymLog's dark look, independent of theme).
const W = 1080;
const H = 1920;
const MAX_EXERCISES = 7;

export interface WorkoutCardData {
  date: string; // YYYY-MM-DD
  routineName: string;
  volume: string; // formatted, e.g. "4,820 kg"
  sets: number;
  streak: number;
  prCount: number;
  exercises: { name: string; sets: number; best: string; pr: boolean }[];
}

function longDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function workoutCard(d: WorkoutCardData, headers?: Record<string, string>) {
  const stats = [
    ["VOLUME", d.volume],
    ["SETS", String(d.sets)],
    ["STREAK", `${d.streak} ${d.streak === 1 ? "day" : "days"}`],
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "110px 90px",
          color: "#e6f1fb",
          background: "radial-gradient(ellipse 120% 60% at 50% 0%, #0c4a6e 0%, #07111f 60%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #7dd3fc 0%, #0ea5e9 100%)",
              color: "#07111f",
              fontSize: 54,
              fontWeight: 800,
            }}
          >
            G
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: 1 }}>GymLog</div>
        </div>

        <div style={{ marginTop: 110, fontSize: 38, color: "#7dd3fc" }}>{longDate(d.date)}</div>
        <div style={{ marginTop: 18, fontSize: 104, fontWeight: 800, lineHeight: 1.05 }}>{d.routineName}</div>
        {d.prCount > 0 && (
          <div
            style={{
              marginTop: 36,
              alignSelf: "flex-start",
              padding: "12px 28px",
              borderRadius: 999,
              background: "#fbbf24",
              color: "#07111f",
              fontSize: 36,
              fontWeight: 800,
            }}
          >
            {`${d.prCount} NEW ${d.prCount === 1 ? "PR" : "PRs"}`}
          </div>
        )}

        <div style={{ marginTop: 70, display: "flex", gap: 24 }}>
          {stats.map(([label, value]) => (
            <div
              key={label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: "30px 32px",
                borderRadius: 32,
                background: "rgba(255,255,255,0.06)",
                border: "2px solid rgba(255,255,255,0.1)",
              }}
            >
              <div style={{ fontSize: 28, color: "#94a3b8", letterSpacing: 2 }}>{label}</div>
              <div style={{ marginTop: 10, fontSize: 50, fontWeight: 800 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 60, display: "flex", flexDirection: "column", gap: 22 }}>
          {d.exercises.slice(0, MAX_EXERCISES).map((ex) => (
            <div
              key={ex.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 22,
                borderBottom: "2px solid rgba(255,255,255,0.08)",
                fontSize: 42,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 18, maxWidth: 560 }}>
                <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{ex.name}</span>
                {ex.pr && (
                  <span
                    style={{
                      padding: "4px 14px",
                      borderRadius: 10,
                      background: "#fbbf24",
                      color: "#07111f",
                      fontSize: 26,
                      fontWeight: 800,
                    }}
                  >
                    PR
                  </span>
                )}
              </div>
              <div style={{ display: "flex", color: "#94a3b8" }}>
                {`${ex.sets} ×`}<span style={{ marginLeft: 14, color: "#e6f1fb", fontWeight: 700 }}>{ex.best}</span>
              </div>
            </div>
          ))}
          {d.exercises.length > MAX_EXERCISES && (
            <div style={{ fontSize: 34, color: "#94a3b8" }}>{`+ ${d.exercises.length - MAX_EXERCISES} more`}</div>
          )}
        </div>
      </div>
    ),
    { width: W, height: H, headers }
  );
}
