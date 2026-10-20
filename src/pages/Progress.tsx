import { IonContent, IonPage, IonRefresher, IonRefresherContent } from '@ionic/react';
import { useCallback, useState } from 'react';
import { useUserId } from '../auth/AuthProvider';
import { Button, Card } from '../components';
import { deleteActivity, loadProgress, type ProgressActivity } from '../data/progress';
import { useLoader } from '../data/useLoader';
import type { Range } from '../lib/progress';
import DeleteActivitySheet from './progress/DeleteActivitySheet';
import ProgressView from './progress/ProgressView';
import './Progress.css';

const Progress: React.FC = () => {
  const userId = useUserId();
  const load = useCallback(() => loadProgress(userId), [userId]);
  const { data, error, loading, reload } = useLoader(load);
  const [range, setRange] = useState<Range>('Week');
  const [deleting, setDeleting] = useState<ProgressActivity | null>(null);

  return (
    <IonPage>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void reload().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="screen">
          <h1 className="t-title-lg">Progress</h1>
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
            <ProgressView data={data} range={range} onRange={setRange} now={new Date()} onDelete={setDeleting} />
          )}
        </div>
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
