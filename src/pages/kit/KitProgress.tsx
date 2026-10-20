import { IonContent, IonPage } from '@ionic/react';
import { useState } from 'react';
import type { ProgressActivity, ProgressData } from '../../data/progress';
import type { ActivityType, PersonalRecordRow } from '../../lib/database.types';
import { addDays, dateKey, startOfDay } from '../../lib/dates';
import type { Range } from '../../lib/progress';
import DeleteActivitySheet from '../progress/DeleteActivitySheet';
import ProgressView from '../progress/ProgressView';
import '../Progress.css';

// Dev-only: Progress with the artboard's week (W 50, T 47, F 0, S 76, S 40, M 60, T 38 min)
// plus a previous week, some matches and personal records.
const now = new Date();
let n = 0;
const act = (daysAgo: number, type: ActivityType, minutes: number, extra: Partial<ProgressActivity> = {}): ProgressActivity => ({
  id: `a${n++}`,
  user_id: 'u',
  type,
  duration_min: minutes,
  kcal: minutes * 7,
  distance_km: null,
  logged_at: new Date(addDays(startOfDay(now), -daysAgo).getTime() + 18 * 3600e3).toISOString(),
  session_id: null,
  pace_sec_per_km: null,
  venue: null,
  match_type: null,
  wins: null,
  losses: null,
  workoutName: null,
  ...extra,
});

const activity: ProgressActivity[] = [
  act(0, 'lift', 38, { workoutName: 'Push' }),
  act(1, 'run', 30, { distance_km: 5.2, pace_sec_per_km: 346 }),
  act(1, 'swim', 30, { distance_km: 1.5, venue: 'pool' }),
  act(2, 'pickleball', 40, { match_type: 'doubles', wins: 3, losses: 2 }),
  act(3, 'tennis', 76, { match_type: 'singles', wins: 4, losses: 3 }),
  act(5, 'lift', 47, { workoutName: 'Pull' }),
  act(6, 'run', 50, { distance_km: 8.1, pace_sec_per_km: 370 }),
  // previous week, 264 min in total, so this week is +18%
  ...[50, 44, 60, 40, 70].map((m, i) => act(8 + i, 'pickleball', m, { match_type: 'doubles', wins: 2 + (i % 3), losses: 2 })),
  ...Array.from({ length: 30 }, (_, i) => act(20 + i * 3, i % 2 ? 'lift' : 'run', 45, i % 2 ? { workoutName: 'Lower' } : { distance_km: 6 })),
];

const rec = (id: string, name: string, value: number, unit: PersonalRecordRow['unit'], daysAgo: number): PersonalRecordRow => ({
  id,
  user_id: 'u',
  name,
  value,
  unit,
  achieved_on: dateKey(addDays(now, -daysAgo)),
});

const data: ProgressData = {
  profile: { units: 'metric', active_goal_min: 45 },
  activity,
  sessionsEndedAt: activity.filter((a) => a.type === 'lift').map((a) => a.logged_at),
  records: [
    rec('r1', 'Incline DB Bench Press', 12, 'stack', 22),
    rec('r2', 'Incline DB Bench Press', 13, 'stack', 5),
    rec('r3', 'Shrugs', 25, 'kg', 40),
    rec('r4', 'Shrugs', 27.5, 'kg', 12),
  ],
};

const KitProgress: React.FC = () => {
  const [range, setRange] = useState<Range>('Week');
  const [kit, setKit] = useState(data);
  const [deleting, setDeleting] = useState<ProgressActivity | null>(null);
  return (
    <IonPage>
      <IonContent>
        <div className="screen">
          <h1 className="t-title-lg">Progress</h1>
          <ProgressView data={kit} range={range} onRange={setRange} now={now} onDelete={setDeleting} />
        </div>
        <DeleteActivitySheet
          activity={deleting}
          onDismiss={() => setDeleting(null)}
          onConfirm={async (a) => {
            setKit((d) => ({ ...d, activity: d.activity.filter((x) => x.id !== a.id) }));
            setDeleting(null);
          }}
        />
      </IonContent>
    </IonPage>
  );
};

export default KitProgress;
