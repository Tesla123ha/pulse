// Pure workout-session model: what is current, what is done, how long it has run.
import { plural } from './format';
import type { SetLogRow, WorkoutExerciseRow, WorkoutSessionRow } from './database.types';

export interface SessionModel {
  /** Exercises in session order (after swaps). */
  order: WorkoutExerciseRow[];
  setsFor: (exerciseId: string) => SetLogRow[];
  isDone: (ex: WorkoutExerciseRow) => boolean;
  isSkipped: (ex: WorkoutExerciseRow) => boolean;
  /** First exercise that is neither done nor skipped; null when the workout is complete. */
  current: WorkoutExerciseRow | null;
  /** 1-based position of `current` (or the count when complete). */
  currentNumber: number;
  /** The exercise after `current` that still needs work. */
  next: WorkoutExerciseRow | null;
  finishedCount: number;
  allDone: boolean;
}

export function orderExercises(exercises: WorkoutExerciseRow[], order: string[] | null): WorkoutExerciseRow[] {
  const byPosition = [...exercises].sort((a, b) => a.position - b.position);
  if (!order) return byPosition;
  const byId = new Map(byPosition.map((e) => [e.id, e]));
  const ordered = order.map((id) => byId.get(id)).filter((e): e is WorkoutExerciseRow => Boolean(e));
  return [...ordered, ...byPosition.filter((e) => !order.includes(e.id))];
}

export function buildModel(
  session: Pick<WorkoutSessionRow, 'exercise_order' | 'skipped_exercise_ids'>,
  exercises: WorkoutExerciseRow[],
  sets: SetLogRow[],
): SessionModel {
  const order = orderExercises(exercises, session.exercise_order);
  const skipped = new Set(session.skipped_exercise_ids);
  const setsFor = (id: string) =>
    sets.filter((s) => s.exercise_id === id).sort((a, b) => a.set_number - b.set_number);
  const isDone = (ex: WorkoutExerciseRow) => setsFor(ex.id).length >= ex.target_sets;
  const isSkipped = (ex: WorkoutExerciseRow) => skipped.has(ex.id);
  const open = (ex: WorkoutExerciseRow) => !isDone(ex) && !isSkipped(ex);
  const currentIdx = order.findIndex(open);
  const current = currentIdx >= 0 ? order[currentIdx] : null;
  const next = currentIdx >= 0 ? (order.slice(currentIdx + 1).find(open) ?? null) : null;
  return {
    order,
    setsFor,
    isDone,
    isSkipped,
    current,
    currentNumber: currentIdx >= 0 ? currentIdx + 1 : order.length,
    next,
    finishedCount: order.filter(isDone).length,
    allDone: current === null,
  };
}

/** Seconds of training time, excluding pauses. */
export function elapsedSeconds(
  session: Pick<WorkoutSessionRow, 'started_at' | 'paused_at' | 'paused_seconds' | 'ended_at'>,
  now: Date,
): number {
  const end = session.ended_at ? new Date(session.ended_at) : session.paused_at ? new Date(session.paused_at) : now;
  const sec = (end.getTime() - new Date(session.started_at).getTime()) / 1000 - session.paused_seconds;
  return Math.max(0, Math.floor(sec));
}

/** 1458 -> "24:18", 3725 -> "1:02:05" */
export function formatClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

const range = (ex: WorkoutExerciseRow) => (ex.rep_min === ex.rep_max ? `${ex.rep_min}` : `${ex.rep_min}–${ex.rep_max}`);

/** "4 sets × 10–12 reps", "3 sets × max reps", "3 sets × 30 s hold" */
export const targetText = (ex: WorkoutExerciseRow) =>
  ex.target_type === 'max'
    ? `${ex.target_sets} sets × max reps`
    : ex.target_type === 'seconds'
      ? `${ex.target_sets} sets × ${ex.rep_min} s hold`
      : `${ex.target_sets} sets × ${range(ex)} reps`;

/** "3 × 15", "3 × Max", "3 × 30 s" */
export const shortTarget = (ex: WorkoutExerciseRow) =>
  `${ex.target_sets} × ${ex.target_type === 'max' ? 'Max' : ex.target_type === 'seconds' ? `${ex.rep_min} s` : range(ex)}`;

export const exerciseCaption = (model: Pick<SessionModel, 'currentNumber' | 'order' | 'allDone'>) =>
  model.allDone ? `All ${model.order.length} exercises done` : `Exercise ${model.currentNumber} of ${model.order.length}`;

/** What ending saves, named as a consequence. */
export function finishMessage(
  session: Pick<WorkoutSessionRow, 'exercise_order' | 'skipped_exercise_ids'>,
  exercises: WorkoutExerciseRow[],
  sets: SetLogRow[],
): string {
  const model = buildModel(session, exercises, sets);
  if (sets.length === 0) return 'You have not logged a set yet, so nothing is saved to Progress.';
  if (model.allDone) return `All ${plural(model.finishedCount, 'exercise')} are done and saved to Progress.`;
  const parts: { text: string; n: number }[] = [];
  if (model.finishedCount > 0) parts.push({ text: plural(model.finishedCount, 'finished exercise'), n: model.finishedCount });
  for (const e of model.order) {
    const n = model.setsFor(e.id).length;
    if (n > 0 && !model.isDone(e)) parts.push({ text: `${plural(n, 'set')} of ${e.name}`, n });
  }
  const verb = parts.length > 1 || parts[0].n > 1 ? 'are' : 'is';
  return `Your ${parts.map((p) => p.text).join(' and ')} ${verb} saved to Progress.`;
}
