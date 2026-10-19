import { IonContent, IonPage } from '@ionic/react';
import { useState } from 'react';
import type { HomeData } from '../../data/home';
import type { ActivityMeta } from '../../lib/activity';
import type { ActivityLogRow, ActivityType, ProfileRow } from '../../lib/database.types';
import HomeView, { HomeHeader } from '../home/HomeView';
import QuickLogSheet from '../home/QuickLogSheet';
import '../Home.css';

// Dev-only: Home rendered with the artboard's sample values, to compare layout at 390px.
const profile: ProfileRow = {
  id: 'kit',
  display_name: null,
  workouts_per_week: 4,
  move_goal_kcal: 600,
  calorie_goal: 2200,
  protein_goal_g: 140,
  carbs_goal_g: 240,
  fat_goal_g: 70,
  water_goal_glasses: 8,
  main_focus: 'Build strength',
  units: 'metric',
  reminders_enabled: true,
  created_at: '',
  updated_at: '',
};
const log = (type: ActivityType, duration_min: number, distance_km: number | null): ActivityLogRow => ({
  id: type,
  user_id: 'kit',
  type,
  duration_min,
  distance_km,
  kcal: 0,
  logged_at: '',
  session_id: null,
  pace_sec_per_km: null,
  venue: null,
  match_type: null,
  wins: null,
  losses: null,
});
const data: HomeData = {
  profile,
  week: [
    { letter: 'W', name: 'Wednesday', status: 'done' },
    { letter: 'T', name: 'Thursday', status: 'done' },
    { letter: 'F', name: 'Friday', status: 'missed' },
    { letter: 'S', name: 'Saturday', status: 'done' },
    { letter: 'S', name: 'Sunday', status: 'done' },
    { letter: 'M', name: 'Monday', status: 'done' },
    { letter: 'T', name: 'Tuesday', status: 'today' },
  ],
  activeDays: 5,
  streak: 3,
  burnedKcal: 420,
  activeMin: 38,
  workout: {
    workoutId: 'kit',
    name: 'Upper Body Strength',
    durationMin: 45,
    level: 'Intermediate',
    exerciseCount: 6,
    planWorkoutId: null,
    openSessionId: null,
  },
  lastByType: {
    run: { ...log('run', 29, 5.2), pace_sec_per_km: 330 },
    swim: { ...log('swim', 35, 1.5), venue: 'pool' },
    pickleball: { ...log('pickleball', 90, null), match_type: 'doubles', wins: 3, losses: 2 },
    tennis: { ...log('tennis', 60, null), match_type: 'singles', wins: 1, losses: 1 },
  },
  eatenKcal: 1420,
};

const KitHome: React.FC = () => {
  const [logging, setLogging] = useState<ActivityMeta | null>(null);
  return (
    <IonPage>
      <IonContent>
        <div className="screen">
          <HomeHeader today={new Date(2026, 9, 13)} />
          <HomeView data={data} onLog={setLogging} />
        </div>
        <QuickLogSheet
          activity={logging}
          last={logging ? data.lastByType[logging.type] : undefined}
          units="metric"
          onDismiss={() => setLogging(null)}
          onSave={async () => setLogging(null)}
        />
      </IonContent>
    </IonPage>
  );
};

export default KitHome;
