import { IonContent, IonPage, useIonRouter } from '@ionic/react';
import { useCallback, useEffect, useState } from 'react';
import { useUserId } from '../auth/AuthProvider';
import { endSession, loadOpenSession } from '../data/session';
import { errorMessage, useLoader } from '../data/useLoader';
import { useNow } from '../data/useNow';
import FinishView from './session/FinishView';
import './Session.css';

const Finish: React.FC = () => {
  const userId = useUserId();
  const router = useIonRouter();
  const load = useCallback(() => loadOpenSession(userId), [userId]);
  const { data, loading, error } = useLoader(load);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const now = useNow(data?.session.status === 'in_progress');

  // Nothing to finish: go home.
  useEffect(() => {
    if (!loading && !error && !data) router.push('/home', 'root', 'replace');
  }, [loading, error, data, router]);

  return (
    <IonPage>
      <IonContent>
        {error && (
          <div className="screen" role="alert">
            <p className="t-title-sm">The workout could not load</p>
            <p className="t-cap">{error}</p>
          </div>
        )}
        {data && (
          <FinishView
            data={data}
            now={now}
            busy={busy}
            error={actionError}
            onKeepGoing={() => (router.canGoBack() ? router.goBack() : router.push('/session', 'back', 'replace'))}
            onEnd={async () => {
              setBusy(true);
              setActionError(null);
              try {
                await endSession(data, userId);
                router.push('/home', 'root', 'replace');
              } catch (e) {
                setActionError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default Finish;
