import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Icon, Stagger, StaggerItem, Stepper } from '../../components';
import type { SessionData } from '../../data/session';
import type { SetLogRow, Units, WorkoutExerciseRow } from '../../lib/database.types';
import { formatInt, plural } from '../../lib/format';
import {
  formatEffort,
  formatSet,
  fromDisplayLoad,
  loadStep,
  loadUnitLabel,
  storedLoad,
  toDisplayLoad,
} from '../../lib/load';
import { buildModel, elapsedSeconds, formatClock, shortTarget, targetText } from '../../lib/session';

export interface SessionActions {
  /** `load` is stored units: kg, or stack level for machine exercises. */
  onCompleteSet: (load: number, reps: number) => void;
  onSwap: () => void;
  onSkip: () => void;
  onNote: () => void;
}

/** The most recent earlier set for this exercise, preferring the same set number. */
function lastTimeFor(history: SetLogRow[], exerciseId: string, setNumber: number): SetLogRow | undefined {
  const mine = history.filter((h) => h.exercise_id === exerciseId);
  if (!mine.length) return undefined;
  const lastSession = mine[0].session_id;
  return mine.find((h) => h.session_id === lastSession && h.set_number === setNumber) ?? mine[0];
}

const roundTo = (v: number, step: number) => Math.round(v / step) * step;

/** Progress across exercises: one segment each, filled by sets done. */
const ExerciseProgress: React.FC<{ fractions: number[]; label: string }> = ({ fractions, label }) => (
  <div className="session-progress" role="img" aria-label={label}>
    {fractions.map((f, i) => (
      <span key={i} className="session-progress__seg">
        <span className="session-progress__fill" style={{ width: `${Math.min(1, f) * 100}%` }} />
      </span>
    ))}
  </div>
);

export interface SessionViewProps extends SessionActions {
  data: SessionData;
  now: Date;
  busy: boolean;
  error: string | null;
}

const SessionView: React.FC<SessionViewProps> = ({ data, now, busy, error, ...actions }) => {
  const { session, workout, exercises, sets, history, units } = data;
  const model = useMemo(() => buildModel(session, exercises, sets), [session, exercises, sets]);
  const current = model.current;
  const doneSets = current ? model.setsFor(current.id) : [];
  const setNumber = doneSets.length + 1;
  const paused = session.status === 'paused';
  const lastTime = current ? lastTimeFor(history, current.id, setNumber) : undefined;

  // Stepper values (display units), reset when the active set changes.
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(1);
  const activeKey = current ? `${current.id}:${setNumber}` : 'done';
  useEffect(() => {
    if (!current) return;
    const seed = lastTime ?? doneSets[doneSets.length - 1];
    const stored = seed ? storedLoad(seed, current) : Number(current.start_load ?? 0);
    setWeight(roundTo(toDisplayLoad(stored, current, units), loadStep(current, units) / 2));
    setReps(seed ? seed.reps : current.target_type === 'max' ? 10 : current.rep_min);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, units]);

  const fractions = model.order.map((ex) =>
    model.isSkipped(ex) && !model.isDone(ex) ? 0 : model.setsFor(ex.id).length / ex.target_sets,
  );
  const total = model.order.length;

  return (
    <Stagger className="stack">
      <StaggerItem>
        <div className="session-top">
          <ExerciseProgress
            fractions={fractions}
            label={current ? `Exercise ${model.currentNumber} of ${total} in progress` : `All ${total} exercises done`}
          />
          <div className="session-clock">
            <span
              className="t-display-xl"
              role="timer"
              aria-label={`Elapsed ${formatClock(elapsedSeconds(session, now))}`}
            >
              {formatClock(elapsedSeconds(session, now))}
            </span>
            <span className="t-cap">{paused ? 'Paused' : 'Elapsed'}</span>
          </div>
        </div>
      </StaggerItem>

      {current ? (
        <>
          <StaggerItem>
            <Card level="raised" className="session-card">
              <div className="session-card__head">
                <h2 className="t-title-md">{current.name}</h2>
                <div className="t-cap">{[...current.muscles, targetText(current)].join(' · ')}</div>
              </div>

              {doneSets.map((s) => (
                <div key={s.id} className="session-set">
                  <span className="t-secondary">Set {s.set_number}</span>
                  <span className="row" style={{ gap: 'var(--space-3)' }}>
                    <span className="t-strong">{formatSet(s, current, units)}</span>
                    <span className="session-set__check">
                      <Icon name="check" size={16} strokeWidth={3} label="Done" />
                    </span>
                  </span>
                </div>
              ))}

              <ActiveSet
                exercise={current}
                setNumber={setNumber}
                lastTime={lastTime ? formatSet(lastTime, current, units) : null}
                units={units}
                weight={weight}
                reps={reps}
                onWeight={setWeight}
                onReps={setReps}
              />

              {Array.from({ length: Math.max(0, current.target_sets - setNumber) }, (_, i) => (
                <div key={i} className="session-set t-muted">
                  <span>Set {setNumber + i + 1}</span>
                  <span>Target {formatEffort(fromDisplayLoad(weight, current, units), reps, current, units)}</span>
                </div>
              ))}
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Button
              variant="primary"
              size="lg"
              block
              disabled={busy || paused}
              onClick={() => actions.onCompleteSet(fromDisplayLoad(weight, current, units), reps)}
            >
              <Icon name="check" />
              Complete set {setNumber}
            </Button>
          </StaggerItem>
          {error && (
            <p className="t-cap" role="alert" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}

          <StaggerItem>
            <div className="session-next">
              <span className="t-cap">
                {model.next ? `Next: ${model.next.name} · ${shortTarget(model.next)}` : 'Last exercise'}
              </span>
              <span className="t-cap">{formatInt(current.rest_seconds)} s rest after each set</span>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="session-tools">
              <Button
                variant="ghost"
                className="session-tool"
                disabled={busy || !model.next}
                aria-label="Swap: do the next exercise first"
                onClick={actions.onSwap}
              >
                <Icon name="swap" size={20} />
                Swap
              </Button>
              <Button
                variant="ghost"
                className="session-tool"
                disabled={busy}
                aria-label={`Skip ${current.name}`}
                onClick={actions.onSkip}
              >
                <Icon name="skip" size={20} />
                Skip
              </Button>
              <Button variant="ghost" className="session-tool" disabled={busy} onClick={actions.onNote}>
                <Icon name="pencil" size={20} />
                {session.notes ? 'Edit note' : 'Note'}
              </Button>
            </div>
          </StaggerItem>
        </>
      ) : (
        <StaggerItem>
          <Card level="raised" hero className="session-card">
            <h2 className="t-title-md">All exercises done</h2>
            <p className="t-cap">
              {plural(model.finishedCount, 'exercise')} · {plural(sets.length, 'set')} logged · {workout.name}
            </p>
            <Button variant="primary" size="lg" block routerLink="/finish" style={{ marginTop: 'var(--space-4)' }}>
              Finish workout
            </Button>
          </Card>
        </StaggerItem>
      )}
    </Stagger>
  );
};

const ActiveSet: React.FC<{
  exercise: WorkoutExerciseRow;
  setNumber: number;
  lastTime: string | null;
  units: Units;
  weight: number;
  reps: number;
  onWeight: (v: number) => void;
  onReps: (v: number) => void;
}> = ({ exercise, setNumber, lastTime, units, weight, reps, onWeight, onReps }) => (
  <Card level="active" className="session-active">
    <div className="sec-head">
      <span className="session-active__label">Set {setNumber} · now</span>
      <span className="t-cap t-muted">{lastTime ? `Last time: ${lastTime}` : 'First time'}</span>
    </div>
    <div className="session-active__row">
      <span className="t-cap">
        {exercise.load_unit === 'stack' ? 'Stack' : 'Weight'} ({loadUnitLabel(exercise, units)})
      </span>
      <Stepper
        name={exercise.load_unit === 'stack' ? 'stack level' : 'weight'}
        value={weight}
        step={loadStep(exercise, units)}
        min={0}
        max={1000}
        onChange={onWeight}
      />
    </div>
    <div className="session-active__row">
      <span className="t-cap">{exercise.target_type === 'seconds' ? 'Hold (s)' : 'Reps'}</span>
      <Stepper
        name={exercise.target_type === 'seconds' ? 'hold time' : 'reps'}
        value={reps}
        step={exercise.target_type === 'seconds' ? 5 : 1}
        min={0}
        max={exercise.target_type === 'seconds' ? 600 : 100}
        onChange={onReps}
      />
    </div>
  </Card>
);

/** Header row shared by Session and Finish. */
export const SessionHeader: React.FC<{ title: string; caption: string; backLabel?: string }> = ({
  title,
  caption,
  backLabel = 'Back to home',
}) => (
  <div className="session-hdr">
    <Button iconOnly aria-label={backLabel} routerLink="/home" routerDirection="back">
      <Icon name="chevronLeft" />
    </Button>
    <div className="session-hdr__title">
      <h1 className="t-title-sm">{title}</h1>
      <div className="t-cap">{caption}</div>
    </div>
    <span className="session-hdr__spacer" aria-hidden="true" />
  </div>
);

export default SessionView;
