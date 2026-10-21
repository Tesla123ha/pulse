import { Button, Card, Icon, ProgressBar, ProgressRing, Stagger, StaggerItem, WeekStrip } from '../../components';
import type { HomeData } from '../../data/home';
import { QUICK_LOG, lastEntryText, type ActivityMeta } from '../../lib/activity';
import { formatHeaderDate } from '../../lib/dates';
import { formatInt, plural } from '../../lib/format';
import { relativeDay } from '../../lib/history';
import { formatLoadTotal } from '../../lib/units';

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
      {/* A card that appears after the first render (the last workout) would stay hidden under a running
          entrance, so a change in the card set starts the entrance afresh. */}
      <Stagger className="split" key={data.lastWorkout ? 'with-last' : 'no-last'}>
        <div className="split__col">
          <StaggerItem>
            <section className="section" aria-labelledby="week-title">
              <div className="sec-head">
                <h2 id="week-title" className="t-title-sm">
                  This week
                </h2>
                <span className="t-cap">{weekCaption}</span>
              </div>
              <WeekStrip days={data.week} />
              {profile.workouts_per_week > 0 && (
                <div className="home-goal">
                  <ProgressBar
                    value={data.workoutsThisWeek / profile.workouts_per_week}
                    label={`${data.workoutsThisWeek} of ${profile.workouts_per_week} weekly workouts`}
                  />
                  <p className="t-cap">
                    {data.workoutsThisWeek >= profile.workouts_per_week
                      ? `Weekly goal reached: ${plural(data.workoutsThisWeek, 'workout')} in the last 7 days`
                      : `${data.workoutsThisWeek} of ${plural(profile.workouts_per_week, 'workout')} in the last 7 days`}
                  </p>
                </div>
              )}
            </section>
          </StaggerItem>

          <StaggerItem>
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
          </StaggerItem>
        </div>
        <div className="split__col">
          {workout && (
            <StaggerItem>
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
            </StaggerItem>
          )}

          {data.lastWorkout && (
            <StaggerItem>
              <Card className="home-last">
                <div className="sec-head">
                  <span className="t-cap">Last workout · {relativeDay(data.lastWorkout.endedAt, new Date())}</span>
                  <Button variant="plain" routerLink="/history" aria-label="Open workout history">
                    History
                    <Icon name="chevronRight" size={20} />
                  </Button>
                </div>
                <h2 className="t-title-sm">{data.lastWorkout.workoutName}</h2>
                <div className="t-cap">
                  {[
                    data.lastWorkout.durationMin > 0 && `${formatInt(data.lastWorkout.durationMin)} min`,
                    plural(data.lastWorkout.setCount, 'set'),
                    data.lastWorkout.volumeKg > 0 && `${formatLoadTotal(data.lastWorkout.volumeKg, units)} lifted`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </Card>
            </StaggerItem>
          )}

          <StaggerItem>
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
          </StaggerItem>
        </div>
      </Stagger>
    </>
  );
};

export default HomeView;
