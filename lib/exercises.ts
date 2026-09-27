export const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Core",
  "Full Body",
  "Cardio",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Common exercises with their primary muscle group. */
export const EXERCISE_LIBRARY: { name: string; muscle: MuscleGroup }[] = [
  // Chest
  { name: "Bench Press", muscle: "Chest" },
  { name: "Incline Bench Press", muscle: "Chest" },
  { name: "Decline Bench Press", muscle: "Chest" },
  { name: "Dumbbell Bench Press", muscle: "Chest" },
  { name: "Incline Dumbbell Press", muscle: "Chest" },
  { name: "Chest Fly", muscle: "Chest" },
  { name: "Cable Crossover", muscle: "Chest" },
  { name: "Chest Press Machine", muscle: "Chest" },
  { name: "Push-Up", muscle: "Chest" },
  { name: "Dip", muscle: "Chest" },
  // Back
  { name: "Deadlift", muscle: "Back" },
  { name: "Pull-Up", muscle: "Back" },
  { name: "Chin-Up", muscle: "Back" },
  { name: "Lat Pulldown", muscle: "Back" },
  { name: "Barbell Row", muscle: "Back" },
  { name: "Dumbbell Row", muscle: "Back" },
  { name: "Seated Cable Row", muscle: "Back" },
  { name: "T-Bar Row", muscle: "Back" },
  { name: "Face Pull", muscle: "Back" },
  { name: "Back Extension", muscle: "Back" },
  // Shoulders
  { name: "Overhead Press", muscle: "Shoulders" },
  { name: "Dumbbell Shoulder Press", muscle: "Shoulders" },
  { name: "Arnold Press", muscle: "Shoulders" },
  { name: "Lateral Raise", muscle: "Shoulders" },
  { name: "Front Raise", muscle: "Shoulders" },
  { name: "Rear Delt Fly", muscle: "Shoulders" },
  { name: "Upright Row", muscle: "Shoulders" },
  { name: "Shrug", muscle: "Shoulders" },
  // Arms
  { name: "Barbell Curl", muscle: "Biceps" },
  { name: "Dumbbell Curl", muscle: "Biceps" },
  { name: "Hammer Curl", muscle: "Biceps" },
  { name: "Preacher Curl", muscle: "Biceps" },
  { name: "Cable Curl", muscle: "Biceps" },
  { name: "Tricep Pushdown", muscle: "Triceps" },
  { name: "Skull Crusher", muscle: "Triceps" },
  { name: "Overhead Tricep Extension", muscle: "Triceps" },
  { name: "Close-Grip Bench Press", muscle: "Triceps" },
  { name: "Tricep Dip", muscle: "Triceps" },
  // Legs
  { name: "Squat", muscle: "Quads" },
  { name: "Front Squat", muscle: "Quads" },
  { name: "Leg Press", muscle: "Quads" },
  { name: "Leg Extension", muscle: "Quads" },
  { name: "Bulgarian Split Squat", muscle: "Quads" },
  { name: "Lunge", muscle: "Quads" },
  { name: "Hack Squat", muscle: "Quads" },
  { name: "Goblet Squat", muscle: "Quads" },
  { name: "Romanian Deadlift", muscle: "Hamstrings" },
  { name: "Leg Curl", muscle: "Hamstrings" },
  { name: "Good Morning", muscle: "Hamstrings" },
  { name: "Hip Thrust", muscle: "Glutes" },
  { name: "Glute Bridge", muscle: "Glutes" },
  { name: "Cable Kickback", muscle: "Glutes" },
  { name: "Hip Abduction", muscle: "Glutes" },
  { name: "Standing Calf Raise", muscle: "Calves" },
  { name: "Seated Calf Raise", muscle: "Calves" },
  // Core
  { name: "Plank", muscle: "Core" },
  { name: "Crunch", muscle: "Core" },
  { name: "Hanging Leg Raise", muscle: "Core" },
  { name: "Cable Crunch", muscle: "Core" },
  { name: "Russian Twist", muscle: "Core" },
  { name: "Ab Wheel Rollout", muscle: "Core" },
  // Full body / cardio
  { name: "Clean and Press", muscle: "Full Body" },
  { name: "Kettlebell Swing", muscle: "Full Body" },
  { name: "Burpee", muscle: "Full Body" },
  { name: "Farmer's Walk", muscle: "Full Body" },
  { name: "Treadmill", muscle: "Cardio" },
  { name: "Rowing Machine", muscle: "Cardio" },
  { name: "Stationary Bike", muscle: "Cardio" },
  { name: "Jump Rope", muscle: "Cardio" },
];

/** Normalise for comparison: "  bench   PRESS " -> "bench press" */
export function exerciseKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Canonical spelling for a typed exercise name: reuse an existing spelling
 * (user's own history first, then the library) so "bench press" and
 * "Bench Press" stay one exercise.
 */
export function canonicalExerciseName(name: string, known: string[] = []): string {
  const cleaned = name.trim().replace(/\s+/g, " ");
  const key = exerciseKey(cleaned);
  const match =
    known.find((k) => exerciseKey(k) === key) ??
    EXERCISE_LIBRARY.find((e) => exerciseKey(e.name) === key)?.name;
  return match ?? cleaned;
}

export function libraryMuscle(name: string): MuscleGroup | null {
  const key = exerciseKey(name);
  return EXERCISE_LIBRARY.find((e) => exerciseKey(e.name) === key)?.muscle ?? null;
}
