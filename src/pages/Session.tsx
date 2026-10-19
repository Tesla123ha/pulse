import { IonContent, IonFooter, IonPage, useIonRouter } from '@ionic/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Card, Icon } from '../components';
import { useUserId } from '../auth/AuthProvider';
import {
  loadOrStartSession,
  logSet,
  pauseSession,
  resumeSession,
  saveNotes,
  skipExercise,
  swapWithNext,
  type SessionData,
} from '../data/session';
import { errorMessage, useLoader } from '../data/useLoader';
import { useNow } from '../data/useNow';
import { buildModel, exerciseCaption } from '../lib/session';
import type { WorkoutSessionRow } from '../lib/database.types';
import SessionView, { SessionHeader } from './session/SessionView';
import NoteSheet from './session/NoteSheet';
import './Session.css';

/** Footer with Pause and Finish; shared with the kit preview. */
export const SessionFooter: React.FC<{ paused: boolean; busy: boolean; onTogglePause: () => void }> = ({
  paused,
  busy,
  onTogglePause,
}) => (
  <IonFooter className="session-footer">
    <div className="session-footer__bar">
      <Button disabled={busy} onClick={onTogglePause}>
        <Icon name={paused ? 'play' : 'pause'} />
        {paused ? 'Resume' : 'Pause'}
      </Button>
      <Button variant="stop" routerLink="/finish">
        <Icon name="stop" />
        Finish
      </Button>
    </div>
  </IonFooter>
);

const Session: React.FC = () => {
  const userId = useUserId();
  const router = useIonRouter();
  const { search } = useLocation();
  const start = useMemo(() => {
    const p = new URLSearchParams(search);
    const workoutId = p.get('workout');
    return workoutId ? { workoutId, planWorkoutId: p.get('slot') } : null;
  }, [search]);

  const load = useCallback(() => loadOrStartSession(userId, start), [userId, start]);
  const { data, error, loading, reload, setData } = useLoader<SessionData | null>(load);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const now = useNow(data?.session.status === 'in_progress');

  // Once started, drop the start parameters so a reload resumes instead.
  useEffect(() => {
    if (data && search) router.push('/session', 'none', 'replace');
  }, [data, search, router]);

  const run = async (fn: (d: SessionData) => Promise<(d: SessionData) => SessionData>) => {
    if (!data) return;
    setBusy(true);
    setActionError(null);
    try {
      const apply = await fn(data);
      setData((d) => (d ? apply(d) : d));
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const withSession = (s: WorkoutSessionRow) => (d: SessionData) => ({ ...d, session: s });

  const model = data ? buildModel(data.session, data.exercises, data.sets) : null;

  return (
    <IonPage>
      <IonContent>
        <div className="screen">
          <SessionHeader
            title={data?.workout.name ?? 'Workout'}
            caption={model ? exerciseCaption(model) : loading ? 'Loading' : ''}
          />

          {error && (
            <Card role="alert">
              <p className="t-title-sm">The workout could not load</p>
              <p className="t-cap">{error}</p>
              <Button style={{ marginTop: 'var(--space-3)' }} onClick={() => void reload()}>
                Try again
              </Button>
            </Card>
          )}

          {!loading && !error && !data && (
            <Card>
              <p className="t-title-sm">No workout in progress</p>
              <p className="t-cap">Pick a workout to start a session.</p>
              <Button style={{ marginTop: 'var(--space-3)' }} routerLink="/workouts">
                Browse workouts
              </Button>
            </Card>
          )}

          {data && (
            <SessionView
              data={data}
              now={now}
              busy={busy}
              error={actionError}
              onCompleteSet={(load, reps) =>
                void run(async (d) => {
                  const m = buildModel(d.session, d.exercises, d.sets);
                  if (!m.current) return (x) => x;
                  const row = await logSet({
                    sessionId: d.session.id,
                    exercise: m.current,
                    setNumber: m.setsFor(m.current.id).length + 1,
                    load,
                    reps,
                  });
                  return (x) => ({ ...x, sets: [...x.sets, row] });
                })
              }
              onSwap={() =>
                void run(async (d) => {
                  const m = buildModel(d.session, d.exercises, d.sets);
                  if (!m.current || !m.next) return (x) => x;
                  return withSession(
                    await swapWithNext(
                      d.session,
                      m.order.map((e) => e.id),
                      m.current.id,
                      m.next.id,
                    ),
                  );
                })
              }
              onSkip={() =>
                void run(async (d) => {
                  const m = buildModel(d.session, d.exercises, d.sets);
                  return m.current ? withSession(await skipExercise(d.session, m.current.id)) : (x) => x;
                })
              }
              onNote={() => setNoteOpen(true)}
            />
          )}
        </div>

        {data && (
          <NoteSheet
            isOpen={noteOpen}
            initial={data.session.notes ?? ''}
            onDismiss={() => setNoteOpen(false)}
            onSave={async (notes) => {
              await run(async (d) => withSession(await saveNotes(d.session, notes)));
              setNoteOpen(false);
            }}
          />
        )}
      </IonContent>
      {data && (
        <SessionFooter
          paused={data.session.status === 'paused'}
          busy={busy}
          onTogglePause={() =>
            void run(async (d) =>
              withSession(await (d.session.status === 'paused' ? resumeSession(d.session) : pauseSession(d.session))),
            )
          }
        />
      )}
    </IonPage>
  );
};

export default Session;
