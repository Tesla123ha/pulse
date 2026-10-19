import { IonContent, IonPage } from '@ionic/react';
import { Button } from '../components';
import { supabase } from '../lib/supabase';

/** Temporary screen until its build step lands. */
const Placeholder: React.FC<{ title: string; showSignOut?: boolean }> = ({ title, showSignOut }) => (
  <IonPage>
    <IonContent>
      <div className="screen">
        <h1 className="t-title-lg">{title}</h1>
        <p className="t-cap">This screen is built in a later step.</p>
        {showSignOut && (
          <Button variant="ghost" block onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        )}
      </div>
    </IonContent>
  </IonPage>
);

export default Placeholder;
