import { IonInput } from '@ionic/react';
import { Button, Card, ChipRow, Icon, ListRow, ProgressBar } from '../../components';
import type { WorkoutWithExercises, WorkoutsData } from '../../data/workouts';
import { CATEGORY_ICON, FILTERS, filterWorkouts, workoutCaption, type WorkoutFilter } from '../../lib/workouts';

const RECOMMENDED_COUNT = 4;

export interface WorkoutsViewProps {
  data: WorkoutsData;
  filter: WorkoutFilter;
  query: string;
  showAll: boolean;
  onFilter: (f: WorkoutFilter) => void;
  onQuery: (q: string) => void;
  onShowAll: (v: boolean) => void;
  onOpen: (w: WorkoutWithExercises) => void;
}

/** Search, filters, plan card and the workout list. Pure: everything comes from props. */
const WorkoutsView: React.FC<WorkoutsViewProps> = ({
  data,
  filter,
  query,
  showAll,
  onFilter,
  onQuery,
  onShowAll,
  onOpen,
}) => {
  const results = filterWorkouts(data.workouts, filter, query, data.planWorkoutIds);
  const narrowed = filter !== 'All' || query.trim() !== '';
  const shown = narrowed || showAll ? results : results.slice(0, RECOMMENDED_COUNT);
  const { plan, openSession } = data;

  const planLink = openSession
    ? '/session'
    : plan?.next
      ? `/session?workout=${plan.next.workoutId}&slot=${plan.next.slotId}`
      : undefined;

  return (
    <>
      <div className="split">
        <div className="split__col">
          <label className="field__control workouts-search">
            <Icon name="search" />
            <IonInput
              aria-label="Search workouts"
              placeholder="Search workouts"
              value={query}
              clearInput
              onIonInput={(e) => onQuery(String(e.detail.value ?? ''))}
            />
          </label>

          <ChipRow label="Filter workouts" options={FILTERS} value={filter} onChange={onFilter} />

          {plan && (
            <Card level="raised" className="workouts-plan">
              <div className="t-cap">
                Your plan · Week {plan.currentWeek} of {plan.totalWeeks}
              </div>
              <h2 className="t-title-md">{plan.name}</h2>
              <ProgressBar
                value={plan.total > 0 ? plan.done / plan.total : 0}
                label={`${plan.done} of ${plan.total} workouts done`}
              />
              <div className="t-cap">
                {plan.next
                  ? `${plan.done} of ${plan.total} workouts done · Next: ${plan.next.workoutName}`
                  : `All ${plan.total} workouts done. Plan complete.`}
              </div>
              {planLink && (
                <Button variant="primary" block routerLink={planLink}>
                  {openSession ? `Resume ${openSession.workoutName}` : 'Continue plan'}
                </Button>
              )}
            </Card>
          )}
        </div>
        <div className="split__col">
          <section className="section" aria-labelledby="workouts-list-title">
            <div className="sec-head">
              <h2 id="workouts-list-title" className="t-title-sm">
                {narrowed
                  ? `${results.length} ${results.length === 1 ? 'workout' : 'workouts'}`
                  : showAll
                    ? 'All workouts'
                    : 'Recommended'}
              </h2>
              {!narrowed && results.length > RECOMMENDED_COUNT && (
                <Button variant="plain" className="workouts-seeall" onClick={() => onShowAll(!showAll)}>
                  {showAll ? 'Show less' : 'See all'}
                  <Icon name="chevronRight" size={20} />
                </Button>
              )}
            </div>

            {shown.length === 0 ? (
              <Card>
                <p className="t-title-sm">No workouts match</p>
                <p className="t-cap">Try another filter or clear the search.</p>
                <Button
                  variant="ghost"
                  style={{ marginTop: 'var(--space-3)' }}
                  onClick={() => {
                    onQuery('');
                    onFilter('All');
                  }}
                >
                  Clear filters
                </Button>
              </Card>
            ) : (
              <div className="workouts-list">
                {shown.map((w) => (
                  <ListRow
                    key={w.id}
                    icon={CATEGORY_ICON[w.category]}
                    title={w.name}
                    caption={workoutCaption(w)}
                    onClick={() => onOpen(w)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default WorkoutsView;
