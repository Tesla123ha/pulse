// Dev-only sample session matching the Workout session artboard.
import type { SessionData } from '../../data/session';
import type { SetLogRow, WorkoutExerciseRow } from '../../lib/database.types';

const ex = (
  position: number,
  name: string,
  muscles: string[],
  sets: number,
  min: number,
  max: number,
): WorkoutExerciseRow => ({
  id: `ex${position}`,
  workout_id: 'w',
  position,
  name,
  muscles,
  target_sets: sets,
  rep_min: min,
  rep_max: max,
  rest_seconds: 90,
  load_unit: 'kg',
  target_type: 'reps',
  start_load: null,
});

// A dumbbell lift set on plate levels, so the PL choice is visible in the kit.
const onPl = (e: WorkoutExerciseRow): WorkoutExerciseRow => ({
  ...e,
  load_unit: 'stack',
  start_load: 12,
});

const exercises = [
  ex(1, 'Dumbbell Bench Press', ['Chest', 'Triceps'], 4, 8, 10),
  ex(2, 'One-Arm Dumbbell Row', ['Back', 'Biceps'], 4, 10, 12),
  onPl(ex(3, 'Incline Dumbbell Press', ['Chest', 'Shoulders'], 4, 10, 12)),
  ex(4, 'Lateral Raise', ['Shoulders'], 3, 15, 15),
  ex(5, 'Dumbbell Biceps Curl', ['Biceps'], 3, 10, 12),
  ex(6, 'Overhead Triceps Extension', ['Triceps'], 3, 10, 12),
];

const set = (session: string, exercise: string, n: number, kg: number, reps: number): SetLogRow => ({
  id: `${session}-${exercise}-${n}`,
  session_id: session,
  exercise_id: exercise,
  set_number: n,
  weight_kg: kg,
  reps,
  stack_level: null,
  logged_at: '2026-10-01T00:00:00Z',
});

const plSet = (session: string, exercise: string, n: number, level: number, reps: number): SetLogRow => ({
  ...set(session, exercise, n, 0, reps),
  stack_level: level,
});

export function sessionFixture(): SessionData {
  const started = new Date(Date.now() - (24 * 60 + 18) * 1000).toISOString();
  return {
    session: {
      id: 's',
      user_id: 'u',
      workout_id: 'w',
      plan_workout_id: null,
      started_at: started,
      ended_at: null,
      status: 'in_progress',
      paused_at: null,
      paused_seconds: 0,
      exercise_order: null,
      skipped_exercise_ids: [],
      notes: null,
    },
    workout: {
      id: 'w',
      owner: null,
      name: 'Upper Body Strength',
      category: 'Strength',
      duration_min: 45,
      level: 'Intermediate',
      equipment: 'Dumbbells',
      created_at: '',
    },
    exercises,
    sets: [
      ...[1, 2, 3, 4].map((n) => set('s', 'ex1', n, 25, 10)),
      ...[1, 2, 3, 4].map((n) => set('s', 'ex2', n, 22.5, 12)),
      plSet('s', 'ex3', 1, 12, 12),
      plSet('s', 'ex3', 2, 12, 12),
    ],
    // Newest first: a PL set, then an older set in kg, so every unit has something to start from.
    history: [plSet('old', 'ex3', 3, 12, 10), set('older', 'ex3', 3, 22.5, 10)],
    units: 'metric',
    prefs: {},
  };
}
