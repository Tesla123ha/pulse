import { IonContent, IonPage, IonRefresher, IonRefresherContent, useIonRouter } from '@ionic/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUserId } from '../auth/AuthProvider';
import { Button, Card, Icon } from '../components';
import { loadHistory, loadSessionDetail, type SessionDetail } from '../data/history';
import { errorMessage, useLoader } from '../data/useLoader';
import { plural } from '../lib/format';
import { filterHistory, type HistoryEntry } from '../lib/history';
import HistoryView, { PAGE } from './history/HistoryView';
import './Session.css';
import './History.css';

/** Every finished workout, newest first, with search, detail and a way to repeat one. */
const History: React.FC = () => {
  const userId = useUserId();
  const router = useIonRouter();
  const load = useCallback(() => loadHistory(userId), [userId]);
  const { data, error, loading, reload } = useLoader(load);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<HistoryEntry | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !data) return;
    let live = true;
    setDetail(null);
    setDetailError(null);
    loadSessionDetail(open.sessionId, data.units)
      .then((d) => live && setDetail(d))
      .catch((e: unknown) => live && setDetailError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [open, data]);

  const filtered = useMemo(() => (data ? filterHistory(data.entries, query) : []), [data, query]);
  const back = () => (router.canGoBack() ? router.goBack() : router.push('/workouts', 'back', 'replace'));

  return (
    <IonPage>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void reload().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="screen screen--mid">
          <div className="session-hdr">
            <Button iconOnly aria-label="Back" onClick={back}>
              <Icon name="chevronLeft" />
            </Button>
            <div className="session-hdr__title">
              <h1 className="t-title-sm">Workout history</h1>
              {data && <div className="t-cap">{plural(data.entries.length, 'workout')}</div>}
            </div>
            <span className="session-hdr__spacer" aria-hidden="true" />
          </div>

          {!data && loading && (
            <p className="t-cap" role="status">
              Loading history
            </p>
          )}
          {error && (
            <Card role="alert">
              <p className="t-title-sm">History could not load</p>
              <p className="t-cap">{error}</p>
              <Button style={{ marginTop: 'var(--space-3)' }} onClick={() => void reload()}>
                Try again
              </Button>
            </Card>
          )}
          {data && (
            <HistoryView
              data={data}
              filtered={filtered}
              query={query}
              shown={shown}
              open={open}
              detail={detail}
              detailError={detailError}
              onQuery={(q) => {
                setQuery(q);
                setShown(PAGE);
              }}
              onMore={() => setShown((n) => n + PAGE)}
              onOpen={setOpen}
              onClose={() => setOpen(null)}
              onRepeat={(e) => {
                setOpen(null);
                router.push(`/session?workout=${e.workoutId}`, 'forward');
              }}
            />
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default History;
