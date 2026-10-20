import { IonContent, IonPage, IonRefresher, IonRefresherContent, useIonRouter } from '@ionic/react';
import { useCallback, useState } from 'react';
import { useUserId } from '../auth/AuthProvider';
import { Button, Card, Reveal } from '../components';
import { deleteActivity, loadProgress, type ProgressActivity } from '../data/progress';
import { useLoader } from '../data/useLoader';
import type { Range } from '../lib/progress';
import DeleteActivitySheet from './progress/DeleteActivitySheet';
import LogDaySheet from './progress/LogDaySheet';
import QuickLogSheet from './home/QuickLogSheet';
import { logActivity } from '../data/home';
import type { ActivityMeta } from '../lib/activity';
import ProgressView from './progress/ProgressView';
import './Progress.css';

const Progress: React.FC = () => {
  const userId = useUserId();
  const load = useCallback(() => loadProgress(userId), [userId]);
  const { data, error, loading, reload } = useLoader(load);
  const [range, setRange] = useState<Range>('Week');
  const [deleting, setDeleting] = useState<ProgressActivity | null>(null);
  const router = useIonRouter();
  const [logDay, setLogDay] = useState<string | null>(null);
  const [quick, setQuick] = useState<{ day: string; activity: ActivityMeta } | null>(null);

  return (
    <IonPage>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void reload().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="screen screen--wide">
          <Reveal>
            <h1 className="t-title-lg">Progress</h1>
          </Reveal>
          {!data && loading && (
            <p className="t-cap" role="status">
              Loading progress
            </p>
          )}
          {error && (
            <Card role="alert">
              <p className="t-title-sm">Progress could not load</p>
              <p className="t-cap">{error}</p>
              <Button style={{ marginTop: 'var(--space-3)' }} onClick={() => void reload()}>
                Try again
              </Button>
            </Card>
          )}
          {data && (
            <ProgressView
              data={data}
              range={range}
              onRange={setRange}
              now={new Date()}
              onDelete={setDeleting}
              onLog={setLogDay}
            />
          )}
        </div>
        <LogDaySheet
          day={logDay}
          onDismiss={() => setLogDay(null)}
          onWorkout={(day) => {
            setLogDay(null);
            router.push(`/log-workout?day=${day}`);
          }}
          onActivity={(day, activity) => {
            setLogDay(null);
            setQuick({ day, activity });
          }}
        />
        <QuickLogSheet
          activity={quick?.activity ?? null}
          day={quick?.day}
          last={quick ? data?.activity.find((a) => a.type === quick.activity.type) : undefined}
          units={data?.profile.units ?? 'metric'}
          onDismiss={() => setQuick(null)}
          onSave={async (v) => {
            await logActivity(userId, v);
            setQuick(null);
            await reload();
          }}
        />
        <DeleteActivitySheet
          activity={deleting}
          onDismiss={() => setDeleting(null)}
          onConfirm={async (a) => {
            await deleteActivity(a);
            setDeleting(null);
            await reload();
          }}
        />
      </IonContent>
    </IonPage>
  );
};

export default Progress;
