import { supabase } from '../lib/supabase';
import type { WorkoutExerciseRow, WorkoutRow } from '../lib/database.types';
import { maybe, must } from './useLoader';

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
  const [workouts, plan, open] = await Promise.all([
    supabase
      .from('workouts')
      .select('*, exercises:workout_exercises(*)')
      .order('name')
      .then(must),
    supabase
      .from('user_plans')
      .select('name, total_weeks, plan_workouts(id, position, week_number, completed_at, workout:workouts(id, name))')
      .eq('is_active', true)
      .maybeSingle()
      .then(maybe),
    supabase
      .from('workout_sessions')
      .select('id, workout:workouts(id, name)')
      .in('status', ['in_progress', 'paused'])
      .maybeSingle()
      .then(maybe),
  ]);

  let summary: PlanSummary | null = null;
  let planWorkoutIds: string[] = [];
  if (plan) {
    const slots = [...plan.plan_workouts].sort((a, b) => a.position - b.position);
    const nextSlot = slots.find((s) => !s.completed_at);
    planWorkoutIds = [...new Set(slots.map((s) => s.workout?.id).filter((id): id is string => Boolean(id)))];
    summary = {
      name: plan.name,
      totalWeeks: plan.total_weeks,
      currentWeek: nextSlot?.week_number ?? plan.total_weeks,
      done: slots.filter((s) => s.completed_at).length,
      total: slots.length,
      next:
        nextSlot && nextSlot.workout
          ? { slotId: nextSlot.id, workoutId: nextSlot.workout.id, workoutName: nextSlot.workout.name }
          : null,
    };
  }

  return {
    workouts: workouts.map((w) => ({
      ...w,
      exercises: [...w.exercises].sort((a, b) => a.position - b.position),
    })),
    plan: summary,
    openSession: open?.workout ? { id: open.id, workoutId: open.workout.id, workoutName: open.workout.name } : null,
    planWorkoutIds,
  };
}
