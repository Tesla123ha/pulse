import { getDb } from '../offline/db';
import type { WorkoutExerciseRow, WorkoutRow } from '../lib/database.types';

export interface WorkoutWithExercises extends WorkoutRow {
  exercises: WorkoutExerciseRow[];
}

export interface PlanSummary {
  name: string;
  totalWeeks: number;
  /** Week of the next unfinished workout (or the last week when complete). */
  currentWeek: number;
  done: number;
  total: number;
  /** Next unfinished slot; null when the plan is complete. */
  next: { slotId: string; workoutId: string; workoutName: string } | null;
}

export interface WorkoutsData {
  workouts: WorkoutWithExercises[];
  plan: PlanSummary | null;
  /** The open session, if one is in progress or paused. */
  openSession: { id: string; workoutId: string; workoutName: string } | null;
  /** Workout ids in the active plan, for ordering. */
  planWorkoutIds: string[];
}

export async function loadWorkouts(): Promise<WorkoutsData> {
  const db = getDb();
  const [workouts, exercises, plan, open] = await Promise.all([
    db.workouts.toArray(),
    db.workout_exercises.toArray(),
    db.user_plans.filter((p) => p.is_active).first(),
    db.workout_sessions.where('status').anyOf('in_progress', 'paused').first(),
  ]);
  const byWorkout = new Map<string, WorkoutExerciseRow[]>();
  for (const e of exercises) byWorkout.set(e.workout_id, [...(byWorkout.get(e.workout_id) ?? []), e]);
  const nameOf = new Map(workouts.map((w) => [w.id, w.name]));

  let summary: PlanSummary | null = null;
  let planWorkoutIds: string[] = [];
  if (plan) {
    const slots = (await db.plan_workouts.where('plan_id').equals(plan.id).toArray()).sort(
      (a, b) => a.position - b.position,
    );
    const nextSlot = slots.find((s) => !s.completed_at);
    planWorkoutIds = [...new Set(slots.map((s) => s.workout_id).filter((id) => nameOf.has(id)))];
    summary = {
      name: plan.name,
      totalWeeks: plan.total_weeks,
      currentWeek: nextSlot?.week_number ?? plan.total_weeks,
      done: slots.filter((s) => s.completed_at).length,
      total: slots.length,
      next:
        nextSlot && nameOf.has(nextSlot.workout_id)
          ? { slotId: nextSlot.id, workoutId: nextSlot.workout_id, workoutName: nameOf.get(nextSlot.workout_id) as string }
          : null,
    };
  }

  const openName = open ? nameOf.get(open.workout_id) : undefined;
  return {
    workouts: [...workouts]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((w) => ({
        ...w,
        exercises: [...(byWorkout.get(w.id) ?? [])].sort((a, b) => a.position - b.position),
      })),
    plan: summary,
    openSession: open && openName !== undefined ? { id: open.id, workoutId: open.workout_id, workoutName: openName } : null,
    planWorkoutIds,
  };
}
