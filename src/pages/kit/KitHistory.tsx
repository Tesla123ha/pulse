import { IonContent, IonPage } from '@ionic/react';
import { useMemo, useState } from 'react';
import type { HistoryData, SessionDetail } from '../../data/history';
import { filterHistory, type HistoryEntry } from '../../lib/history';
import HistoryView, { PAGE } from '../history/HistoryView';
import '../Session.css';
import '../History.css';

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const entry = (i: number, name: string, daysAgo: number, over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  sessionId: `h${i}`,
  workoutId: 'kit',
  workoutName: name,
  startedAt: day(daysAgo + 0.04),
  endedAt: day(daysAgo),
  durationMin: 48,
  setCount: 22,
  exerciseCount: 6,
  volumeKg: 3600,
  status: 'completed',
  ...over,
});

const params = new URLSearchParams(window.location.search);
const data: HistoryData = {
  units: 'metric',
  openSession: params.get('open') === '1' ? { workoutName: 'Lower' } : null,
  entries:
    params.get('empty') === '1'
      ? []
      : [
          entry(1, 'Push', 1),
          entry(2, 'Pull', 3, { volumeKg: 0, setCount: 18 }),
          entry(3, 'Lower', 6, { status: 'ended_early', durationMin: 21 }),
          entry(4, 'Upper', 12),
          entry(5, 'Push', 40),
          entry(6, 'Pull', 44),
        ],
};

const detail: SessionDetail = {
  notes: 'Left shoulder felt tight on the last set.',
  exercises: [
    { name: 'Incline DB Bench Press', sets: [1, 2, 3].map((n) => ({ number: n, text: `13 PL x ${9 - n}` })) },
    { name: 'Shrugs', sets: [1, 2].map((n) => ({ number: n, text: '32.5 kg x 10' })) },
  ],
};

const KitHistory: React.FC = () => {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<HistoryEntry | null>(null);
  const filtered = useMemo(() => filterHistory(data.entries, query), [query]);
  return (
    <IonPage>
      <IonContent>
        <div className="screen screen--mid">
          <h1 className="t-title-sm">Workout history</h1>
          <HistoryView
            data={data}
            filtered={filtered}
            query={query}
            shown={shown}
            open={open}
            detail={open ? detail : null}
            detailError={null}
            onQuery={(q) => {
              setQuery(q);
              setShown(PAGE);
            }}
            onMore={() => setShown((n) => n + PAGE)}
            onOpen={setOpen}
            onClose={() => setOpen(null)}
            onRepeat={() => setOpen(null)}
          />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default KitHistory;
