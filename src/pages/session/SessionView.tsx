import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Icon, Stagger, StaggerItem, Stepper } from '../../components';
import type { SessionData } from '../../data/session';
import type { SetLogRow, WorkoutExerciseRow } from '../../lib/database.types';
import { formatInt, plural } from '../../lib/format';
import {
  choiceStep,
  choiceText,
  displayToStored,
  formatChoiceValue,
  formatEffort,
  resolveChoice,
  type LoadChoice,
  type StoredLoad,
} from '../../lib/load';
import { formatSetEffort, seedLoad, switchedLoad, weightIrrelevant } from '../../lib/loadPrefill';
import { buildModel, elapsedSeconds, formatClock, shortTarget, targetText } from '../../lib/session';
import UnitToggle from './UnitToggle';

export interface SessionActions {
  /** `stored` is what to save: kg, or a stack level (PL). */
  onCompleteSet: (stored: StoredLoad, reps: number) => void;
  /** The person picked a weight unit for an exercise; remember it. */
  onChoice?: (exerciseId: string, choice: LoadChoice) => void;
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
  const { session, workout, exercises, sets, history, units, prefs } = data;
  const model = useMemo(() => buildModel(session, exercises, sets), [session, exercises, sets]);
  const current = model.current;
  const doneSets = current ? model.setsFor(current.id) : [];
  const setNumber = doneSets.length + 1;
  const paused = session.status === 'paused';
  const lastTime = current ? lastTimeFor(history, current.id, setNumber) : undefined;

  // Unit chosen this visit, by exercise; otherwise the saved one, else what was last logged.
  const [picked, setPicked] = useState<Record<string, LoadChoice>>({});
  const mine = current ? history.filter((h) => h.exercise_id === current.id) : [];
  const choice: LoadChoice = current
    ? (picked[current.id] ?? resolveChoice(current, units, prefs[current.id], mine[0]))
    : 'kg';
  // Sets to start from, most preferred first: last time, then this session, then older.
  const candidates = [...(lastTime ? [lastTime] : []), ...[...doneSets].reverse(), ...mine];
  const noWeight = current ? weightIrrelevant(current, [...mine, ...doneSets]) : false;

  // Stepper values (in the chosen unit), reset when the active set changes.
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(1);
  const activeKey = current ? `${current.id}:${setNumber}` : 'done';
  useEffect(() => {
    if (!current) return;
    const seed = lastTime ?? doneSets[doneSets.length - 1];
    setWeight(seedLoad(current, choice, candidates));
    setReps(seed ? seed.reps : current.target_type === 'max' ? 10 : current.rep_min);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, units]);

  const changeChoice = (next: LoadChoice) => {
    if (!current || next === choice) return;
    setWeight(switchedLoad(weight, choice, next, seedLoad(current, next, candidates)));
    setPicked((p) => ({ ...p, [current.id]: next }));
    actions.onChoice?.(current.id, next);
  };
  const storedNow = displayToStored(weight, choice);

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
                <div className="t-cap">
                  {[
                    ...current.muscles,
                    targetText(current),
                    ...(!noWeight && weight > 0 ? [formatChoiceValue(weight, choice)] : []),
                  ].join(' · ')}
                </div>
              </div>

              {doneSets.map((s) => (
                <div key={s.id} className="session-set">
                  <span className="t-secondary">Set {s.set_number}</span>
                  <span className="row" style={{ gap: 'var(--space-3)' }}>
                    <span className="t-strong">{formatSetEffort(s, current, choice, units)}</span>
                    <span className="session-set__check">
                      <Icon name="check" size={16} strokeWidth={3} label="Done" />
                    </span>
                  </span>
                </div>
              ))}

              <ActiveSet
                exercise={current}
                setNumber={setNumber}
                lastTime={lastTime ? formatSetEffort(lastTime, current, choice, units) : null}
                choice={choice}
                showUnit={!noWeight}
                onChoice={changeChoice}
                weight={weight}
                reps={reps}
                onWeight={setWeight}
                onReps={setReps}
              />

              {Array.from({ length: Math.max(0, current.target_sets - setNumber) }, (_, i) => (
                <div key={i} className="session-set t-muted">
                  <span>Set {setNumber + i + 1}</span>
                  <span>
                    Target{' '}
                    {formatEffort(
                      choice === 'pl' ? Number(storedNow.stack_level) : storedNow.weight_kg,
                      reps,
                      current,
                      choice,
                    )}
                  </span>
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
              onClick={() => actions.onCompleteSet(storedNow, reps)}
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
  choice: LoadChoice;
  showUnit: boolean;
  onChoice: (c: LoadChoice) => void;
  weight: number;
  reps: number;
  onWeight: (v: number) => void;
  onReps: (v: number) => void;
}> = ({ exercise, setNumber, lastTime, choice, showUnit, onChoice, weight, reps, onWeight, onReps }) => (
  <Card level="active" className="session-active">
    <div className="sec-head">
      <span className="session-active__label">Set {setNumber} · now</span>
      <span className="t-cap t-muted">{lastTime ? `Last time: ${lastTime}` : 'First time'}</span>
    </div>
    {showUnit && (
      <div className="session-active__unit">
        <UnitToggle exercise={exercise.name} value={choice} onChange={onChoice} />
      </div>
    )}
    <div className="session-active__row">
      <span className="t-cap">
        {choice === 'pl' ? 'Stack' : 'Weight'} ({choiceText(choice)})
      </span>
      <Stepper
        name={choice === 'pl' ? 'stack level' : 'weight'}
        value={weight}
        step={choiceStep(choice)}
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
