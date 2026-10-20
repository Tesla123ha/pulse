import { IonContent, IonPage, IonRefresher, IonRefresherContent } from '@ionic/react';
import { useCallback, useState } from 'react';
import { useAuth, useUserId } from '../auth/AuthProvider';
import { Button, Card } from '../components';
import { exportMyData, loadProfile, updateProfile } from '../data/profile';
import { errorMessage, useLoader } from '../data/useLoader';
import { dateKey } from '../lib/dates';
import type { EditField } from '../lib/profile';
import { supabase } from '../lib/supabase';
import pkg from '../../package.json';
import EditSheet from './profile/EditSheet';
import PrivacySheet from './profile/PrivacySheet';
import ProfileView from './profile/ProfileView';
import './Profile.css';

/** Saves text as a file through a temporary link. */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const Profile: React.FC = () => {
  const userId = useUserId();
  const { session } = useAuth();
  const email = session?.user.email ?? '';
  const load = useCallback(() => loadProfile(userId, email), [userId, email]);
  const { data, error, loading, reload, setData } = useLoader(load);
  const [editing, setEditing] = useState<EditField | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const save = async (patch: Parameters<typeof updateProfile>[1]) => {
    const profile = await updateProfile(userId, patch);
    setData((d) => ({ ...d, profile }));
  };

  return (
    <IonPage>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void reload().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="screen profile">
          {!data && loading && (
            <p className="t-cap" role="status">
              Loading profile
            </p>
          )}
          {error && (
            <Card role="alert">
              <p className="t-title-sm">Your profile could not load</p>
              <p className="t-cap">{error}</p>
              <Button style={{ marginTop: 'var(--space-3)' }} onClick={() => void reload()}>
                Try again
              </Button>
            </Card>
          )}
          {actionError && (
            <p className="t-cap" role="alert" style={{ color: 'var(--danger)' }}>
              {actionError}
            </p>
          )}
          {data && (
            <ProfileView
              data={data}
              version={pkg.version}
              busy={busy}
              onEdit={setEditing}
              onReminders={async (on) => {
                setActionError(null);
                try {
                  await save({ reminders_enabled: on });
                } catch (e) {
                  setActionError(errorMessage(e));
                }
              }}
              onPrivacy={() => setPrivacy(true)}
              onSignOut={async () => {
                setBusy(true);
                await supabase.auth.signOut();
                setBusy(false);
              }}
            />
          )}
          {/* If the profile cannot load, still offer a way to sign out. */}
          {error && (
            <Button variant="ghost" block onClick={() => void supabase.auth.signOut()}>
              Sign out
            </Button>
          )}
        </div>
        {data && (
          <EditSheet
            field={editing}
            profile={data.profile}
            onDismiss={() => setEditing(null)}
            onSave={async (patch) => {
              await save(patch);
              setEditing(null);
            }}
          />
        )}
        <PrivacySheet
          isOpen={privacy}
          onDismiss={() => setPrivacy(false)}
          onExport={async () => download(`pulse-data-${dateKey(new Date())}.json`, await exportMyData())}
        />
      </IonContent>
    </IonPage>
  );
};

export default Profile;
