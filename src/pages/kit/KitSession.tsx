import { IonContent, IonPage } from '@ionic/react';
import { useState } from 'react';
import { useNow } from '../../data/useNow';
import { buildModel, exerciseCaption } from '../../lib/session';
import { SessionFooter } from '../Session';
import SessionView, { SessionHeader } from '../session/SessionView';
import { sessionFixture } from './sessionFixture';
import '../Session.css';

// Dev-only: Workout session with the artboard's sample values. Actions update local state only.
const KitSession: React.FC = () => {
  const [data, setData] = useState(sessionFixture);
  const now = useNow(data.session.status === 'in_progress');
  const model = buildModel(data.session, data.exercises, data.sets);
  return (
    <IonPage>
      <IonContent>
        <div className="screen">
          <SessionHeader title={data.workout.name} caption={exerciseCaption(model)} />
          <SessionView
            data={data}
            now={now}
            busy={false}
            error={null}
            onCompleteSet={(load, reps) => {
              if (!model.current) return;
              const n = model.setsFor(model.current.id).length + 1;
              const id = model.current.id;
              const stack = model.current.load_unit === 'stack';
              setData((d) => ({
                ...d,
                sets: [
                  ...d.sets,
                  {
                    id: `${id}-${n}`,
                    session_id: 's',
                    exercise_id: id,
                    set_number: n,
                    weight_kg: stack ? 0 : load,
                    stack_level: stack ? load : null,
                    reps,
                    logged_at: '',
                  },
                ],
              }));
            }}
            onSwap={() => undefined}
            onSkip={() => undefined}
            onNote={() => undefined}
          />
        </div>
      </IonContent>
      <SessionFooter
        paused={data.session.status === 'paused'}
        busy={false}
        onTogglePause={() =>
          setData((d) => ({
            ...d,
            session: {
              ...d.session,
              status: d.session.status === 'paused' ? 'in_progress' : 'paused',
              paused_at: d.session.status === 'paused' ? null : new Date().toISOString(),
            },
          }))
        }
      />
    </IonPage>
  );
};

export default KitSession;
