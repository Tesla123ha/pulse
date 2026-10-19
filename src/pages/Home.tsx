import { IonContent, IonPage } from '@ionic/react';

const Home: React.FC = () => (
  <IonPage>
    <IonContent>
      <div className="screen">
        <p className="t-cap">Theme check</p>
        <h1 className="t-title-lg">Today</h1>
      </div>
    </IonContent>
  </IonPage>
);

export default Home;
