import { Button, Card, Icon, ListRow, ProgressRing, WeekStrip } from '../../components';
import type { HomeData } from '../../data/home';
import { QUICK_LOG, lastEntryText, type ActivityMeta } from '../../lib/activity';
import { formatHeaderDate } from '../../lib/dates';
import { formatInt, plural } from '../../lib/format';

export const HomeHeader: React.FC<{ today: Date }> = ({ today }) => (
  <header className="home-hdr">
    <div>
      <p className="t-cap">{formatHeaderDate(today)}</p>
      <h1 className="t-title-lg">Today</h1>
    </div>
    <Button iconOnly aria-label="Notifications" routerLink="/profile">
      <Icon name="bell" />
    </Button>
  </header>
);

/** Home content for loaded data. Pure: everything it shows comes from `data`. */
const HomeView: React.FC<{ data: HomeData; onLog: (a: ActivityMeta) => void }> = ({ data, onLog }) => {
  const { profile, workout } = data;
  const units = profile.units;
  const moveFraction = profile.move_goal_kcal > 0 ? data.burnedKcal / profile.move_goal_kcal : 0;
  const caloriesLeft = Math.max(0, profile.calorie_goal - data.eatenKcal);
  const weekCaption = [plural(data.activeDays, 'active day'), data.streak > 0 && `${formatInt(data.streak)}-day streak`]
    .filter(Boolean)
    .join(' · ');
  const sessionLink = workout
    ? workout.openSessionId
      ? '/session'
      : `/session?workout=${workout.workoutId}${workout.planWorkoutId ? `&slot=${workout.planWorkoutId}` : ''}`
    : undefined;

  return (
    <>
      <section className="section" aria-labelledby="week-title">
        <div className="sec-head">
          <h2 id="week-title" className="t-title-sm">
            This week
          </h2>
          <span className="t-cap">{weekCaption}</span>
        </div>
        <WeekStrip days={data.week} />
      </section>

      <Card className="home-ring">
        <ProgressRing
          value={moveFraction}
          label={`${Math.round(Math.min(1, moveFraction) * 100)} percent of daily move goal`}
        />
        <div className="grow">
          <div className="t-cap">Burned today</div>
          <div className="home-ring__value">
            <span className="t-num">{formatInt(data.burnedKcal)}</span>
            <span className="t-cap">/ {formatInt(profile.move_goal_kcal)} kcal</span>
          </div>
          <div className="t-cap" style={{ marginTop: 'var(--space-2)' }}>
            {formatInt(data.activeMin)} min active
          </div>
        </div>
      </Card>

      {workout && (
        <Card level="raised" hero xl className="home-workout">
          <div className="t-cap">{workout.openSessionId ? 'Workout in progress' : "Today's workout"}</div>
          <h2 className="t-title-md">{workout.name}</h2>
          <div className="t-cap">
            {formatInt(workout.durationMin)} min · {plural(workout.exerciseCount, 'exercise')} · {workout.level}
          </div>
          <Button variant="primary" size="lg" block routerLink={sessionLink}>
            {workout.openSessionId ? 'Resume workout' : 'Start workout'}
            <Icon name="arrowRight" />
          </Button>
        </Card>
      )}

      <section className="section" aria-labelledby="quicklog-head">
        <div className="sec-head">
          <h2 id="quicklog-head" className="t-title-sm">
            Quick log
          </h2>
          <span className="t-cap">Last entry shown</span>
        </div>
        <div className="quicklog">
          {QUICK_LOG.map((a) => {
            const last = lastEntryText(a, data.lastByType[a.type], units);
            return (
              <Button
                key={a.type}
                variant="ghost"
                className="quicklog__tile"
                aria-label={`Log ${a.noun}, last entry ${last}`}
                onClick={() => onLog(a)}
              >
                <Icon name={a.icon} />
                <span className="quicklog__name">{a.label}</span>
                <span className="quicklog__last">{last}</span>
              </Button>
            );
          })}
        </div>
      </section>

      <ListRow
        icon="nutrition"
        title="Nutrition"
        caption={`${formatInt(data.eatenKcal)} eaten · ${formatInt(caloriesLeft)} kcal left`}
        routerLink="/nutrition"
      />
    </>
  );
};

export default HomeView;
