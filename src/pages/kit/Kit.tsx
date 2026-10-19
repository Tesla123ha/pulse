import { IonContent, IonPage } from '@ionic/react';
import { useState } from 'react';
import {
  Button,
  Card,
  ChartBars,
  ChipRow,
  Icon,
  ListRow,
  MacroBar,
  ProgressBar,
  ProgressRing,
  Segmented,
  StatTile,
  Stepper,
  Toggle,
  WeekStrip,
} from '../../components';

// Component gallery for visual review. Static sample values from the design system previews.
const Kit: React.FC = () => {
  const [chip, setChip] = useState('All');
  const [range, setRange] = useState<'Week' | 'Month' | 'Year'>('Week');
  const [kg, setKg] = useState(22.5);
  const [reps, setReps] = useState(10);
  const [on, setOn] = useState(true);
  return (
    <IonPage>
      <IonContent>
        <div className="screen" style={{ gap: 'var(--space-6)' }}>
          <h1 className="t-title-lg">Components</h1>

          <section className="section">
            <h2 className="t-title-sm">Button</h2>
            <Button variant="primary" size="lg" block>
              <Icon name="check" /> Complete set 3
            </Button>
            <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <Button>Swap</Button>
              <Button variant="ghost">Pause</Button>
              <Button variant="stop">
                <Icon name="stop" /> Finish
              </Button>
              <Button variant="danger">End workout</Button>
              <Button iconOnly aria-label="Add">
                <Icon name="plus" />
              </Button>
            </div>
          </section>

          <section className="section">
            <h2 className="t-title-sm">Card</h2>
            <Card>
              <div className="t-cap">Surface</div>
              <div className="t-title-sm">Default card</div>
            </Card>
            <Card level="raised" hero>
              <div className="t-cap">Today&apos;s workout</div>
              <div className="t-title-md">Upper Body Strength</div>
            </Card>
            <Card level="active">
              <div className="t-cap">Set 3 · now</div>
            </Card>
          </section>

          <section className="section">
            <h2 className="t-title-sm">Chip and Segmented</h2>
            <ChipRow
              label="Filter"
              options={['All', 'Strength', 'Cardio', 'HIIT', 'Mobility', 'Running']}
              value={chip}
              onChange={setChip}
            />
            <Segmented
              label="Time range"
              options={['Week', 'Month', 'Year'] as const}
              value={range}
              onChange={setRange}
            />
          </section>

          <section className="section">
            <h2 className="t-title-sm">ListRow</h2>
            <ListRow
              icon="workouts"
              title="Full Body Basics"
              caption="30 min · Beginner · Dumbbells"
              onClick={() => undefined}
            />
            <ListRow
              icon="nutrition"
              title="Breakfast"
              caption="Oats, banana, eggs"
              end={
                <span className="pl-listrow__end">
                  <span className="t-strong" style={{ color: 'var(--text)' }}>
                    420
                  </span>
                  kcal
                </span>
              }
            />
          </section>

          <section className="section">
            <h2 className="t-title-sm">StatTile</h2>
            <div className="pl-stat-grid">
              <StatTile label="Workouts" value="5" delta="+1 vs last week" />
              <StatTile label="Burned" value="2,840" unit="kcal" />
            </div>
          </section>

          <section className="section">
            <h2 className="t-title-sm">ProgressRing and bars</h2>
            <div className="row" style={{ gap: 'var(--space-6)' }}>
              <ProgressRing value={0.7} label="70 percent of daily move goal" />
              <div>
                <div className="t-cap">Burned</div>
                <div className="t-display-xl">420</div>
                <div className="t-cap">of 600 kcal</div>
              </div>
            </div>
            <ProgressBar value={0.375} label="3 of 8 workouts done" />
            <div className="pl-macros">
              <MacroBar macro="protein" current={92} target={140} />
              <MacroBar macro="carbs" current={150} target={240} />
              <MacroBar macro="fat" current={40} target={70} />
            </div>
          </section>

          <section className="section">
            <h2 className="t-title-sm">Stepper and Toggle</h2>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="t-cap">Weight (kg)</span>
              <Stepper name="weight" value={kg} step={2.5} onChange={setKg} />
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="t-cap">Reps</span>
              <Stepper name="reps" value={reps} step={1} min={1} onChange={setReps} />
            </div>
            <Toggle label="Workout reminders" checked={on} onChange={setOn} />
          </section>

          <section className="section">
            <h2 className="t-title-sm">WeekStrip</h2>
            <WeekStrip
              days={[
                { letter: 'W', name: 'Wednesday', status: 'done' },
                { letter: 'T', name: 'Thursday', status: 'done' },
                { letter: 'F', name: 'Friday', status: 'missed' },
                { letter: 'S', name: 'Saturday', status: 'done' },
                { letter: 'S', name: 'Sunday', status: 'done' },
                { letter: 'M', name: 'Monday', status: 'done' },
                { letter: 'T', name: 'Tuesday', status: 'today' },
              ]}
            />
          </section>

          <section className="section">
            <h2 className="t-title-sm">ChartBars</h2>
            <Card level="raised">
              <ChartBars
                summary="Active minutes per day this week"
                format={(v) => `${v}m`}
                goal={45}
                currentIndex={6}
                bars={[
                  { label: 'W', name: 'Wednesday', value: 50 },
                  { label: 'T', name: 'Thursday', value: 47 },
                  { label: 'F', name: 'Friday', value: 0 },
                  { label: 'S', name: 'Saturday', value: 76 },
                  { label: 'S', name: 'Sunday', value: 40 },
                  { label: 'M', name: 'Monday', value: 60 },
                  { label: 'T', name: 'Tuesday', value: 38 },
                ]}
              />
            </Card>
          </section>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Kit;
