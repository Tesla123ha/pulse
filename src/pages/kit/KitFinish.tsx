import { IonContent, IonPage } from '@ionic/react';
import { useState } from 'react';
import FinishView from '../session/FinishView';
import { sessionFixture } from './sessionFixture';
import '../Session.css';

// Dev-only: Finish confirmation with the artboard's sample values.
const KitFinish: React.FC = () => {
  const [data] = useState(sessionFixture);
  return (
    <IonPage>
      <IonContent>
        <FinishView
          data={data}
          now={new Date()}
          busy={false}
          error={null}
          onKeepGoing={() => undefined}
          onEnd={() => undefined}
        />
      </IonContent>
    </IonPage>
  );
};

export default KitFinish;
