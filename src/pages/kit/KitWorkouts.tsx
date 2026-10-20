import { IonContent, IonPage } from '@ionic/react';
import { useState } from 'react';
import type { WorkoutWithExercises, WorkoutsData } from '../../data/workouts';
import type { LoadUnit, TargetType, WorkoutCategory, WorkoutExerciseRow } from '../../lib/database.types';
import type { WorkoutFilter } from '../../lib/workouts';
import WorkoutSheet from '../workouts/WorkoutSheet';
import WorkoutsView from '../workouts/WorkoutsView';
import '../Workouts.css';

// Dev-only: Workouts screen with sample data (the seeded splits and library).
const ex = (
  id: string,
  position: number,
  name: string,
  muscle: string,
  reps: number,
  load_unit: LoadUnit,
  start_load: number,
  target_type: TargetType = 'reps',
): WorkoutExerciseRow => ({
  id,
  workout_id: 'push',
  position,
  name,
  muscles: [muscle],
  target_sets: 3,
  rep_min: reps,
  rep_max: reps,
  rest_seconds: 90,
  load_unit,
  target_type,
  start_load,
});

const w = (
  id: string,
  name: string,
  category: WorkoutCategory,
  duration_min: number,
  level: string,
  equipment: string,
  exercises: WorkoutExerciseRow[] = [],
): WorkoutWithExercises => ({ id, owner: null, name, category, duration_min, level, equipment, created_at: '', exercises });

const push = [
  ex('p1', 1, 'Incline DB Bench Press', 'Chest', 8, 'stack', 12),
  ex('p2', 2, 'Flat DB Bench Press', 'Chest', 8, 'stack', 12),
  ex('p3', 3, 'Dumbbell Flys', 'Chest', 12, 'kg', 7.5),
  ex('p4', 4, 'DB Overhead Press', 'Shoulders', 8, 'kg', 10),
  ex('p5', 5, 'Lateral Raises', 'Shoulders', 8, 'kg', 12.5),
  ex('p6', 6, 'Face Pulls', 'Shoulders', 8, 'stack', 6),
  ex('p7', 7, 'JM Press', 'Triceps', 8, 'kg', 10),
  ex('p8', 8, 'Tricep Pushdown / DB OH Tricep Extension', 'Triceps', 8, 'stack', 3),
  ex('p9', 9, 'Plank Scapular Protraction', 'Core', 15, 'kg', 0),
  ex('p10', 10, 'Decline Russian Twists', 'Core', 20, 'kg', 0),
];

const data: WorkoutsData = {
  workouts: [
    w('push', 'Push', 'Strength', 60, 'Intermediate', 'Gym', push),
    w('pull', 'Pull', 'Strength', 60, 'Intermediate', 'Gym', push.slice(0, 1)),
    w('lower', 'Lower', 'Strength', 45, 'Intermediate', 'Gym', push.slice(0, 1)),
    w('upper', 'Upper', 'Strength', 60, 'Intermediate', 'Gym', push.slice(0, 1)),
    w('fbb', 'Full Body Basics', 'Strength', 30, 'Beginner', 'Dumbbells', push.slice(0, 1)),
    w('hiit', '20-Min HIIT Burner', 'HIIT', 20, 'Intermediate', 'Bodyweight'),
    w('run', 'Easy Run Intervals', 'Running', 35, 'Beginner', 'Outdoor'),
    w('mob', 'Mobility Reset', 'Mobility', 15, 'All levels', 'Mat'),
  ],
  plan: {
    name: '4-Week Strength Builder',
    totalWeeks: 4,
    currentWeek: 2,
    done: 5,
    total: 16,
    next: { slotId: 's6', workoutId: 'pull', workoutName: 'Pull' },
  },
  openSession: null,
  planWorkoutIds: ['push', 'pull', 'lower', 'upper'],
};

const KitWorkouts: React.FC = () => {
  const [filter, setFilter] = useState<WorkoutFilter>('All');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<WorkoutWithExercises | null>(null);
  return (
    <IonPage>
      <IonContent>
        <div className="screen screen--wide">
          <h1 className="t-title-lg">Workouts</h1>
          <WorkoutsView
            data={data}
            filter={filter}
            query={query}
            showAll={showAll}
            onFilter={setFilter}
            onQuery={setQuery}
            onShowAll={setShowAll}
            onOpen={setSelected}
          />
        </div>
        <WorkoutSheet workout={selected} data={data} units="metric" onDismiss={() => setSelected(null)} />
      </IonContent>
    </IonPage>
  );
};

export default KitWorkouts;
