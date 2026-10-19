import { IonContent, IonPage } from '@ionic/react';

/** Temporary screen until its build step lands. */
const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <IonPage>
    <IonContent>
      <div className="screen">
        <h1 className="t-title-lg">{title}</h1>
        <p className="t-cap">This screen is built in a later step.</p>
      </div>
    </IonContent>
  </IonPage>
);

export default Placeholder;
