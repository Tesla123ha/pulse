import { IonContent, IonFooter, IonPage, useIonRouter } from '@ionic/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useUserId } from '../auth/AuthProvider';
import { Button, Card, ChipRow, Icon, NumberField, Stepper } from '../components';
import { loadPastWorkout, savePastWorkout, type PastSet, type PastWorkoutData } from '../data/pastWorkout';
import { errorMessage, useLoader } from '../data/useLoader';
import type { WorkoutWithExercises } from '../data/workouts';
import { dateKey, formatHeaderDate, fromDateKey } from '../lib/dates';
import type { SetLogRow, Units, WorkoutExerciseRow } from '../lib/database.types';
import { plural } from '../lib/format';
import { fromDisplayLoad, loadUnitLabel, storedLoad, toDisplayLoad } from '../lib/load';
import { shortTarget } from '../lib/session';
import './Session.css';
import './LogWorkout.css';

interface SetRow {
  done: boolean;
  /** display units: kg/lb, or PL */
  load: number;
  reps: number;
}

/** Most recent earlier sets for an exercise, from its latest session before the day. */
function lastSessionSets(history: SetLogRow[], exerciseId: string): SetLogRow[] {
  const mine = history.filter((h) => h.exercise_id === exerciseId);
  if (!mine.length) return [];
  const session = mine[0].session_id;
  return mine.filter((h) => h.session_id === session).sort((a, b) => a.set_number - b.set_number);
}

function initialRows(ex: WorkoutExerciseRow, history: SetLogRow[], units: Units): SetRow[] {
  const last = lastSessionSets(history, ex.id);
  const roundLoad = (v: number) => Math.round(v * 100) / 100;
  return Array.from({ length: ex.target_sets }, (_, i) => {
    const prev = last.find((s) => s.set_number === i + 1) ?? last[last.length - 1];
    const stored = prev ? storedLoad(prev, ex) : Number(ex.start_load ?? 0);
    return {
      done: true,
      load: roundLoad(toDisplayLoad(stored, ex, units)),
      reps: prev ? prev.reps : ex.target_type === 'max' ? 10 : ex.rep_min,
    };
  });
}

/** Checkbox-style toggle for one set: filled with text when included (filled-selection rule). */
const SetCheck: React.FC<{ checked: boolean; label: string; onToggle: () => void }> = ({ checked, label, onToggle }) => (
  <button
    type="button"
    className={`setcheck${checked ? ' setcheck--on' : ''}`}
    role="checkbox"
    aria-checked={checked}
    aria-label={label}
    onClick={onToggle}
  >
    <span className="setcheck__box">{checked && <Icon name="check" size={16} strokeWidth={3} />}</span>
  </button>
);

const ExerciseCard: React.FC<{
  ex: WorkoutExerciseRow;
  rows: SetRow[];
  units: Units;
  onRows: (rows: SetRow[]) => void;
}> = ({ ex, rows, units, onRows }) => {
  const unit = loadUnitLabel(ex, units);
  const repsUnit = ex.target_type === 'seconds' ? 's' : 'reps';
  const update = (i: number, patch: Partial<SetRow>) => onRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Card className="logex">
      <div>
        <h2 className="t-title-sm">{ex.name}</h2>
        <p className="t-cap">{[...ex.muscles, shortTarget(ex)].join(' · ')}</p>
      </div>
      <ul className="logex__sets">
        {rows.map((r, i) => (
          <li key={i} className={`logex__set${r.done ? '' : ' logex__set--off'}`}>
            <SetCheck checked={r.done} label={`Include ${ex.name} set ${i + 1}`} onToggle={() => update(i, { done: !r.done })} />
            <span className="logex__label">Set {i + 1}</span>
            <NumberField
              label={`${ex.name} set ${i + 1} ${ex.load_unit === 'stack' ? 'stack level' : 'weight'}`}
              value={r.load}
              suffix={unit}
              max={1000}
              disabled={!r.done}
              onChange={(load) => update(i, { load })}
            />
            <NumberField
              label={`${ex.name} set ${i + 1} ${repsUnit === 's' ? 'seconds' : 'reps'}`}
              value={r.reps}
              suffix={repsUnit}
              max={repsUnit === 's' ? 600 : 100}
              disabled={!r.done}
              onChange={(reps) => update(i, { reps: Math.round(reps) })}
            />
          </li>
        ))}
      </ul>
      <Button
        variant="plain"
        className="logex__add"
        onClick={() => onRows([...rows, { ...(rows[rows.length - 1] ?? { load: 0, reps: ex.rep_min }), done: true }])}
      >
        <Icon name="plus" size={20} />
        Add set
      </Button>
    </Card>
  );
};

/** Full entry of a finished gym workout on a past day. */
const LogWorkout: React.FC = () => {
  const userId = useUserId();
  const router = useIonRouter();
  const { search } = useLocation();
  const day = useMemo(() => {
    const raw = new URLSearchParams(search).get('day') ?? '';
    const today = dateKey(new Date());
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
  }, [search]);

  const load = useCallback(() => loadPastWorkout(userId, day), [userId, day]);
  const { data, error, loading, reload } = useLoader<PastWorkoutData>(load);

  const ordered = useMemo(() => {
    if (!data) return [];
    const rank = (w: WorkoutWithExercises) => {
      const i = data.planWorkoutIds.indexOf(w.id);
      return i === -1 ? data.planWorkoutIds.length : i;
    };
    return [...data.workouts].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [data]);

  const [workoutName, setWorkoutName] = useState<string | null>(null);
  const workout = ordered.find((w) => w.name === workoutName) ?? ordered[0] ?? null;
  const [duration, setDuration] = useState(60);
  const [rows, setRows] = useState<Record<string, SetRow[]>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // New workout picked: prefill its sets from history and its duration.
  useEffect(() => {
    if (!data || !workout) return;
    setDuration(workout.duration_min);
    setRows(Object.fromEntries(workout.exercises.map((ex) => [ex.id, initialRows(ex, data.history, data.units)])));
    setSaveError(null);
  }, [data, workout]);

  const ticked = Object.values(rows).reduce((n, rs) => n + rs.filter((r) => r.done).length, 0);
  const back = () => (router.canGoBack() ? router.goBack() : router.push('/progress', 'back', 'replace'));

  const save = async () => {
    if (!data || !workout) return;
    setSaving(true);
    setSaveError(null);
    try {
      const sets: PastSet[] = workout.exercises.flatMap((ex) =>
        (rows[ex.id] ?? [])
          .filter((r) => r.done)
          .map((r, i) => ({
            exerciseId: ex.id,
            setNumber: i + 1,
            load: fromDisplayLoad(r.load, ex, data.units),
            reps: r.reps,
          })),
      );
      await savePastWorkout({ userId, workout, day, durationMin: duration, sets });
      back();
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonContent>
        <div className="screen">
          <div className="session-hdr">
            <Button iconOnly aria-label="Back to Progress" onClick={back}>
              <Icon name="chevronLeft" />
            </Button>
            <div className="session-hdr__title">
              <h1 className="t-title-sm">Log a workout</h1>
              <div className="t-cap">{formatHeaderDate(fromDateKey(day))}</div>
            </div>
            <span className="session-hdr__spacer" aria-hidden="true" />
          </div>

          {!data && loading && (
            <p className="t-cap" role="status">
              Loading workouts
            </p>
          )}
          {error && (
            <Card role="alert">
              <p className="t-title-sm">Workouts could not load</p>
              <p className="t-cap">{error}</p>
              <Button style={{ marginTop: 'var(--space-3)' }} onClick={() => void reload()}>
                Try again
              </Button>
            </Card>
          )}

          {data && workout && (
            <>
              <ChipRow
                label="Workout"
                options={ordered.map((w) => w.name)}
                value={workout.name}
                onChange={setWorkoutName}
              />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="t-cap">Duration (min)</span>
                <Stepper name="duration" value={duration} step={5} min={5} max={300} onChange={setDuration} />
              </div>
              <p className="t-cap">Sets start from what you lifted before this day. Untick any you did not do.</p>
              {workout.exercises.map((ex) => (
                <ExerciseCard
                  key={ex.id}
                  ex={ex}
                  rows={rows[ex.id] ?? []}
                  units={data.units}
                  onRows={(r) => setRows((all) => ({ ...all, [ex.id]: r }))}
                />
              ))}
            </>
          )}
        </div>
      </IonContent>
      {data && workout && (
        <IonFooter className="session-footer">
          <div className="session-footer__bar logworkout-footer">
            {saveError && (
              <p className="t-cap" role="alert" style={{ color: 'var(--danger)' }}>
                {saveError}
              </p>
            )}
            <Button variant="primary" size="lg" block disabled={saving || ticked === 0} onClick={save}>
              Save {workout.name} · {plural(ticked, 'set')}
            </Button>
          </div>
        </IonFooter>
      )}
    </IonPage>
  );
};

export default LogWorkout;
