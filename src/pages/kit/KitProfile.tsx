import { IonContent, IonPage } from '@ionic/react';
import { useState } from 'react';
import type { ProfileData } from '../../data/profile';
import type { EditField } from '../../lib/profile';
import EditSheet from '../profile/EditSheet';
import ProfileView from '../profile/ProfileView';
import '../Profile.css';

// Dev-only: Profile with sample values (2 of 3 achievements earned, as in the artboard).
const initial: ProfileData = {
  email: 'you@example.com',
  profile: {
    id: 'u',
    display_name: 'Robert',
    workouts_per_week: 4,
    move_goal_kcal: 600,
    active_goal_min: 45,
    main_focus: 'Build strength',
    units: 'metric',
    reminders_enabled: true,
    created_at: '2026-10-19T00:00:00Z',
    updated_at: '',
  },
  achievements: [
    {
      id: 'a1',
      code: 'streak_7',
      name: '7-day streak',
      description: 'Be active seven days in a row.',
      icon: 'bolt',
      sort_order: 1,
      earnedAt: '2026-10-19',
    },
    {
      id: 'a2',
      code: 'first_5k',
      name: 'First 5K',
      description: 'Log a run of 5 km or more.',
      icon: 'run',
      sort_order: 2,
      earnedAt: '2026-10-19',
    },
    {
      id: 'a3',
      code: 'workouts_100',
      name: '100 workouts',
      description: 'Finish 100 workouts.',
      icon: 'workouts',
      sort_order: 3,
      earnedAt: null,
    },
  ],
};

const KitProfile: React.FC = () => {
  const [data, setData] = useState(initial);
  const [editing, setEditing] = useState<EditField | null>(null);
  return (
    <IonPage>
      <IonContent>
        <div className="screen screen--wide profile">
          <ProfileView
            data={data}
            version="0.0.1"
            busy={false}
            onEdit={setEditing}
            onReminders={(on) => setData((d) => ({ ...d, profile: { ...d.profile, reminders_enabled: on } }))}
            onPrivacy={() => undefined}
            onSignOut={() => undefined}
          />
        </div>
        <EditSheet
          field={editing}
          profile={data.profile}
          onDismiss={() => setEditing(null)}
          onSave={async (patch) => {
            setData((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
            setEditing(null);
          }}
        />
      </IonContent>
    </IonPage>
  );
};

export default KitProfile;
