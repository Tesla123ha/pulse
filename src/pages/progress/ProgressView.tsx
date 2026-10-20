import { Card, ChartBars, Segmented, StatTile } from '../../components';
import type { ProgressActivity, ProgressData } from '../../data/progress';
import { formatDecimal, formatInt } from '../../lib/format';
import {
  RANGES,
  activeTime,
  between,
  formatMinutes,
  longestStreak,
  matchRecords,
  recordRows,
  type Range,
} from '../../lib/progress';
import { distanceUnit, kmToDisplay } from '../../lib/units';
import TrainingCalendar from './TrainingCalendar';

export interface ProgressViewProps {
  data: ProgressData;
  range: Range;
  onRange: (r: Range) => void;
  now: Date;
  /** Asks to delete one logged activity (the container confirms first). */
  onDelete: (a: ProgressActivity) => void;
}

/** Whole hours for the narrow year columns: "10h". */
const formatHours = (min: number) => `${formatInt(min / 60)}h`;

const GOAL_LABEL: Record<Range, (min: number) => string> = {
  Week: (m) => `${formatInt(m)} min goal`,
  Month: (m) => `${formatMinutes(m)} weekly goal`,
  Year: () => '',
};

/** Progress for the selected range. Pure: everything comes from props. */
const ProgressView: React.FC<ProgressViewProps> = ({ data, range, onRange, now, onDelete }) => {
  const units = data.profile.units;
  const chart = activeTime(data.activity, range, now, data.profile.active_goal_min);
  const inPeriod = between(data.activity, chart.start, chart.end);
  const workouts = data.sessionsEndedAt.filter((t) => {
    const ms = new Date(t).getTime();
    return ms >= chart.start.getTime() && ms < chart.end.getTime();
  }).length;
  const burned = inPeriod.reduce((s, a) => s + a.kcal, 0);
  const runKm = inPeriod.filter((a) => a.type === 'run').reduce((s, a) => s + Number(a.distance_km ?? 0), 0);
  const streak = longestStreak(data.activity);
  const matches = matchRecords(inPeriod);
  const records = recordRows(data.records, units);
  const period = range === 'Week' ? 'this week' : range === 'Month' ? 'in the last 4 weeks' : 'in the last 12 months';

  return (
    <>
      <Segmented label="Time range" options={RANGES} value={range} onChange={onRange} />

      <Card level="raised" className="progress-chart">
        <div className="sec-head">
          <span className="t-cap">Active time</span>
          {chart.goalMin !== null && (
            <span className="row t-cap" style={{ gap: 'var(--space-2)' }}>
              <span aria-hidden="true" className="progress-legend" />
              {GOAL_LABEL[range](chart.goalMin)}
            </span>
          )}
        </div>
        <div className="sec-head" style={{ marginTop: 'var(--space-1)' }}>
          <span className="t-num">{formatMinutes(chart.totalMin)}</span>
          {chart.delta && (
            <span className={chart.delta.up ? 'progress-delta' : 'progress-delta progress-delta--down'}>
              {chart.delta.text}
            </span>
          )}
        </div>
        <ChartBars
          bars={chart.bars}
          currentIndex={chart.bars.length - 1}
          goal={chart.goalMin ?? undefined}
          format={range === 'Year' ? formatHours : formatMinutes}
          summary={`Active time per ${range === 'Week' ? 'day' : range === 'Month' ? 'week' : 'month'}`}
          height={120}
        />
      </Card>

      <div className="pl-stat-grid">
        <StatTile label="Workouts" value={formatInt(workouts)} />
        <StatTile label="Burned" value={formatInt(burned)} unit="kcal" />
        <StatTile label="Run distance" value={formatDecimal(kmToDisplay(runKm, units))} unit={distanceUnit(units)} />
        <StatTile label="Longest streak" value={formatInt(streak)} unit={streak === 1 ? 'day' : 'days'} />
      </div>

      {matches.length > 0 && (
        <section className="section" aria-labelledby="matches-title">
          <div className="sec-head">
            <h2 id="matches-title" className="t-title-sm">
              Match record
            </h2>
            <span className="t-cap">{period}</span>
          </div>
          <div className="progress-list">
            {matches.map((m) => (
              <div key={m.type} className="progress-row">
                <div className="pl-listrow__main">
                  <div className="pl-listrow__title">{m.label}</div>
                  <div className="t-cap">
                    {m.wins}W {m.losses}L · {m.sessions} {m.sessions === 1 ? 'session' : 'sessions'}
                  </div>
                </div>
                <span className="t-num">
                  {m.winRate === null ? 'None' : `${formatDecimal(m.winRate)}%`}
                  <span className="pl-stat__unit">won</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="records-title">
        <h2 id="records-title" className="t-title-sm">
          Personal records
        </h2>
        {records.length === 0 ? (
          <p className="t-cap">Lift more than your previous best in a workout to set a record.</p>
        ) : (
          <div className="progress-list">
            {records.map((r) => (
              <div key={r.id} className="progress-row">
                <div className="pl-listrow__main">
                  <div className="pl-listrow__title">{r.name}</div>
                  <div className="t-cap">{r.caption}</div>
                </div>
                <span className="t-num">{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <TrainingCalendar activity={data.activity} units={units} now={now} onDelete={onDelete} />
    </>
  );
};

export default ProgressView;
