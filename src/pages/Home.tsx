import { IonContent, IonPage, IonRefresher, IonRefresherContent } from '@ionic/react';
import { useCallback, useState } from 'react';
import { Button, Card, Reveal } from '../components';
import { useUserId } from '../auth/AuthProvider';
import { loadHome, logActivity } from '../data/home';
import { useLoader } from '../data/useLoader';
import type { ActivityMeta } from '../lib/activity';
import HomeView, { HomeHeader } from './home/HomeView';
import QuickLogSheet from './home/QuickLogSheet';
import './Home.css';

const Home: React.FC = () => {
  const userId = useUserId();
  const load = useCallback(() => loadHome(userId), [userId]);
  const { data, error, reload } = useLoader(load);
  const [logging, setLogging] = useState<ActivityMeta | null>(null);

  return (
    <IonPage>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void reload().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="screen screen--wide">
          <Reveal>
            <HomeHeader today={new Date()} />
          </Reveal>

          {!data && !error && (
            <p className="t-cap" role="status">
              Loading today
            </p>
          )}

          {error && (
            <Card role="alert">
              <p className="t-title-sm">Today could not load</p>
              <p className="t-cap">{error}</p>
              <Button style={{ marginTop: 'var(--space-3)' }} onClick={() => void reload()}>
                Try again
              </Button>
            </Card>
          )}

          {data && <HomeView data={data} onLog={setLogging} />}
        </div>

        <QuickLogSheet
          activity={logging}
          last={logging && data ? data.lastByType[logging.type] : undefined}
          units={data?.profile.units ?? 'metric'}
          onDismiss={() => setLogging(null)}
          onSave={async (v) => {
            if (!logging) return;
            await logActivity(userId, v);
            setLogging(null);
            await reload();
          }}
        />
      </IonContent>
    </IonPage>
  );
};

export default Home;
