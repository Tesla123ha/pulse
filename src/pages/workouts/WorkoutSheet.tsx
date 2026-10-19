import { Button, Icon, Sheet } from '../../components';
import type { WorkoutWithExercises, WorkoutsData } from '../../data/workouts';
import type { Units, WorkoutExerciseRow } from '../../lib/database.types';
import { plural } from '../../lib/format';
import { formatLoad } from '../../lib/load';
import { shortTarget } from '../../lib/session';
import { workoutCaption } from '../../lib/workouts';

/** Groups consecutive exercises by their first muscle, in workout order. */
function groups(exercises: WorkoutExerciseRow[]) {
  const out: { title: string; items: WorkoutExerciseRow[] }[] = [];
  for (const e of exercises) {
    const title = e.muscles[0] ?? 'Exercises';
    const last = out[out.length - 1];
    if (last && last.title === title) last.items.push(e);
    else out.push({ title, items: [e] });
  }
  return out;
}

export interface WorkoutSheetProps {
  workout: WorkoutWithExercises | null;
  data: WorkoutsData;
  units: Units;
  onDismiss: () => void;
}

/** Exercise list for one workout, with the action to start or resume it. */
const WorkoutSheet: React.FC<WorkoutSheetProps> = ({ workout, data, units, onDismiss }) => {
  if (!workout) return null;
  const open = data.openSession;
  const slot = data.plan?.next?.workoutId === workout.id ? data.plan.next.slotId : null;
  const startLink = `/session?workout=${workout.id}${slot ? `&slot=${slot}` : ''}`;

  return (
    <Sheet isOpen onDismiss={onDismiss} labelledBy="workout-title">
      <div>
        <h2 id="workout-title" className="t-title-md">
          {workout.name}
        </h2>
        <p className="t-cap">
          {workoutCaption(workout)} · {plural(workout.exercises.length, 'exercise')}
        </p>
      </div>

      {workout.exercises.length === 0 ? (
        <p className="t-cap">This workout has no exercises yet.</p>
      ) : (
        <div className="workout-groups">
          {groups(workout.exercises).map((g, i) => (
            <section key={i} className="workout-group" aria-label={g.title}>
              <h3 className="t-cap workout-group__title">{g.title}</h3>
              <ul className="workout-group__list">
                {g.items.map((e) => (
                  <li key={e.id} className="workout-ex">
                    <span className="workout-ex__name">{e.name}</span>
                    <span className="t-cap">
                      {shortTarget(e)}
                      {e.start_load ? ` · ${formatLoad(Number(e.start_load), e, units)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="section">
        {open && open.workoutId !== workout.id && (
          <p className="t-cap" role="note">
            {open.workoutName} is in progress. Finish it before starting another workout.
          </p>
        )}
        {open ? (
          <Button variant="primary" size="lg" block routerLink="/session" onClick={onDismiss}>
            Resume {open.workoutId === workout.id ? 'workout' : open.workoutName}
            <Icon name="arrowRight" />
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            block
            routerLink={startLink}
            onClick={onDismiss}
            disabled={workout.exercises.length === 0}
          >
            Start workout
            <Icon name="arrowRight" />
          </Button>
        )}
        <Button variant="ghost" block onClick={onDismiss}>
          Close
        </Button>
      </div>
    </Sheet>
  );
};

export default WorkoutSheet;
