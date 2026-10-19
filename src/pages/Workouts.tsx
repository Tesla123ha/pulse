import { IonContent, IonPage, IonRefresher, IonRefresherContent } from '@ionic/react';
import { useCallback, useState } from 'react';
import { useUserId } from '../auth/AuthProvider';
import { Button, Card } from '../components';
import { loadWorkouts, type WorkoutWithExercises } from '../data/workouts';
import { must, useLoader } from '../data/useLoader';
import { supabase } from '../lib/supabase';
import type { WorkoutFilter } from '../lib/workouts';
import WorkoutSheet from './workouts/WorkoutSheet';
import WorkoutsView from './workouts/WorkoutsView';
import './Workouts.css';

const Workouts: React.FC = () => {
  const userId = useUserId();
  const load = useCallback(async () => {
    const [data, profile] = await Promise.all([
      loadWorkouts(),
      supabase.from('profiles').select('units').eq('id', userId).single().then(must),
    ]);
    return { ...data, units: profile.units };
  }, [userId]);
  const { data, error, loading, reload } = useLoader(load);
  const [filter, setFilter] = useState<WorkoutFilter>('All');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<WorkoutWithExercises | null>(null);

  return (
    <IonPage>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void reload().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="screen">
          <h1 className="t-title-lg">Workouts</h1>

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
          {data && (
            <WorkoutsView
              data={data}
              filter={filter}
              query={query}
              showAll={showAll}
              onFilter={setFilter}
              onQuery={setQuery}
              onShowAll={setShowAll}
              onOpen={setSelected}
            />
          )}
        </div>
        {data && (
          <WorkoutSheet workout={selected} data={data} units={data.units} onDismiss={() => setSelected(null)} />
        )}
      </IonContent>
    </IonPage>
  );
};

export default Workouts;
