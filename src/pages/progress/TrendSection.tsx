import { useState } from 'react';
import { ChipRow } from '../../components';
import { formatShortDate } from '../../lib/dates';
import { trendChange, type ExerciseTrend } from '../../lib/history';
import { formatChoiceValue } from '../../lib/load';

const W = 300;
const H = 112;
const PAD_X = 10;
const PAD_Y = 14;

/** Line of the best set per workout, oldest to newest. Spaced by workout, not by date. */
const TrendChart: React.FC<{ trend: ExerciseTrend }> = ({ trend }) => {
  const { points, choice } = trend;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (points.length - 1));
  const y = (v: number) => H - PAD_Y - ((v - min) / span) * (H - PAD_Y * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const fmt = (v: number) => formatChoiceValue(v, choice);
  const summary =
    `${trend.name}, best set per workout: ` +
    points.map((p) => `${formatShortDate(new Date(p.date))} ${fmt(p.value)} for ${p.reps} ${p.reps === 1 ? 'rep' : 'reps'}`).join('; ') +
    '.';

  return (
    <div className="trend">
      <svg className="trend__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} preserveAspectRatio="none">
        <line className="trend__grid" x1={PAD_X} x2={W - PAD_X} y1={y(min)} y2={y(min)} />
        <line className="trend__grid" x1={PAD_X} x2={W - PAD_X} y1={y(max)} y2={y(max)} />
        {points.length > 1 && <path className="trend__line" d={path} />}
        {points.map((p, i) => (
          <circle key={p.sessionId} className="trend__dot" cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4.5 : 3} />
        ))}
      </svg>
      <div className="trend__axis" aria-hidden="true">
        <span>{formatShortDate(new Date(points[0].date))}</span>
        <span>{points.length > 1 ? formatShortDate(new Date(points[points.length - 1].date)) : ''}</span>
      </div>
      <div className="trend__scale t-cap" aria-hidden="true">
        <span>Low {fmt(min)}</span>
        <span>High {fmt(max)}</span>
      </div>
    </div>
  );
};

/** Strength trends: pick a lift, see its best set in each recent workout. */
const TrendSection: React.FC<{ trends: ExerciseTrend[] }> = ({ trends }) => {
  const names = trends.map((t) => t.name);
  const [picked, setPicked] = useState<string | null>(null);
  const trend = trends.find((t) => t.name === picked) ?? trends[0];

  return (
    <section className="section" aria-labelledby="trends-title">
      <div className="sec-head">
        <h2 id="trends-title" className="t-title-sm">
          Lift trends
        </h2>
        {trend && <span className="t-cap">Best set per workout</span>}
      </div>
      {!trend ? (
        <p className="t-cap">Finish a workout with weights to see how each lift changes.</p>
      ) : (
        <div className="pl-card trend-card">
          {names.length > 1 && <ChipRow label="Choose a lift" options={names} value={trend.name} onChange={setPicked} />}
          {(() => {
            const change = trendChange(trend.points);
            const last = trend.points[trend.points.length - 1];
            return (
              <div className="sec-head">
                <span className="t-num">{formatChoiceValue(last.value, trend.choice)}</span>
                <span className="t-cap">
                  {change
                    ? `${change.delta > 0 ? '+' : ''}${formatChoiceValue(change.delta, trend.choice)} over ${trend.points.length} workouts`
                    : 'Log this lift once more to see a trend'}
                </span>
              </div>
            );
          })()}
          <TrendChart trend={trend} />
        </div>
      )}
    </section>
  );
};

export default TrendSection;
