import { useMemo, useState } from 'react';
import { Card, ChartBars, Segmented, Stagger, StaggerItem, StatTile } from '../../components';
import type { ProgressActivity, ProgressData } from '../../data/progress';
import { dateKey, fromDateKey, startOfDay } from '../../lib/dates';
import { formatDecimal, formatInt } from '../../lib/format';
import {
  RANGES,
  activeTime,
  between,
  formatMinutes,
  longestStreak,
  matchRecords,
  monthDelta,
  monthHeatmap,
  monthPeriod,
  recordRows,
  type Range,
} from '../../lib/progress';
import { distanceUnit, kmToDisplay } from '../../lib/units';
import DayList from './DayList';
import MonthHeatmap from './MonthHeatmap';

export interface ProgressViewProps {
  data: ProgressData;
  range: Range;
  onRange: (r: Range) => void;
  now: Date;
  /** Asks to delete one logged activity (the container confirms first). */
  onDelete: (a: ProgressActivity) => void;
  /** Add to a day from the calendar. */
  onLog: (day: string) => void;
}

/** Whole hours for the narrow year columns: "10h". */
const formatHours = (min: number) => `${formatInt(min / 60)}h`;

const GOAL_LABEL: Record<Range, (min: number) => string> = {
  Week: (m) => `${formatInt(m)} min goal`,
  Month: () => '',
  Year: () => '',
};

/** Progress for the selected range. Pure: everything comes from props. */
const ProgressView: React.FC<ProgressViewProps> = ({ data, range, onRange, now, onDelete, onLog }) => {
  const units = data.profile.units;
  const today = startOfDay(now);
  const goalMin = data.profile.active_goal_min;
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() => dateKey(today));
  const isMonth = range === 'Month';
  const viewed = monthPeriod(month, now);

  const chart = activeTime(data.activity, range, now, goalMin);
  const periodStart = isMonth ? viewed.start : chart.start;
  const periodEnd = isMonth ? viewed.end : chart.end;
  const heat = useMemo(() => monthHeatmap(data.activity, month, today, goalMin), [data.activity, month, today, goalMin]);
  const delta = isMonth ? monthDelta(data.activity, month, now) : chart.delta;
  const selectedItems = data.activity.filter((a) => dateKey(new Date(a.logged_at)) === selected);

  const shiftMonth = (n: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(next);
    const current = next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth();
    setSelected(dateKey(current ? today : next));
  };

  const inPeriod = between(data.activity, periodStart, periodEnd);
  const workouts = data.sessionsEndedAt.filter((t) => {
    const ms = new Date(t).getTime();
    return ms >= periodStart.getTime() && ms < periodEnd.getTime();
  }).length;
  const burned = inPeriod.reduce((s, a) => s + a.kcal, 0);
  const runKm = inPeriod.filter((a) => a.type === 'run').reduce((s, a) => s + Number(a.distance_km ?? 0), 0);
  const streak = longestStreak(data.activity);
  const matches = matchRecords(inPeriod);
  const records = recordRows(data.records, units);
  const period = range === 'Week' ? 'this week' : isMonth ? viewed.caption : 'in the last 12 months';

  return (
    <>
      <Stagger className="split">
        <div className="split__col">
          <StaggerItem>
            <Segmented label="Time range" options={RANGES} value={range} onChange={onRange} />
          </StaggerItem>

          <StaggerItem>
            <Card level="raised" className="progress-chart">
              <div className="sec-head">
                <span className="t-cap">Active time</span>
                {!isMonth && chart.goalMin !== null && (
                  <span className="row t-cap" style={{ gap: 'var(--space-2)' }}>
                    <span aria-hidden="true" className="progress-legend" />
                    {GOAL_LABEL[range](chart.goalMin)}
                  </span>
                )}
              </div>
              <div className="sec-head" style={{ marginTop: 'var(--space-1)' }}>
                <span className="t-num">{formatMinutes(isMonth ? heat.totalMin : chart.totalMin)}</span>
                {delta && (
                  <span className={delta.up ? 'progress-delta' : 'progress-delta progress-delta--down'}>{delta.text}</span>
                )}
              </div>
              {isMonth ? (
                <MonthHeatmap
                  month={month}
                  today={today}
                  heat={heat}
                  goalMin={goalMin}
                  selected={selected}
                  onSelect={setSelected}
                  onShift={shiftMonth}
                  emptyText={`No activity in ${viewed.name} yet. Tap a day to log one.`}
                />
              ) : (
                <ChartBars
                  bars={chart.bars}
                  currentIndex={chart.bars.length - 1}
                  goal={chart.goalMin ?? undefined}
                  format={range === 'Year' ? formatHours : formatMinutes}
                  summary={`Active time per ${range === 'Week' ? 'day' : 'month'}`}
                  height={120}
                />
              )}
            </Card>
          </StaggerItem>

          {/* Plain (not StaggerItem): items that mount after the entrance has played would stay hidden. */}
          {isMonth && (
            <>
              <DayList
                date={fromDateKey(selected)}
                today={today}
                items={selectedItems}
                units={units}
                onDelete={onDelete}
                onLog={onLog}
              />
            </>
          )}

          <StaggerItem>
            <div className="pl-stat-grid">
              <StatTile label="Workouts" value={formatInt(workouts)} />
              <StatTile label="Burned" value={formatInt(burned)} unit="kcal" />
              <StatTile
                label="Run distance"
                value={formatDecimal(kmToDisplay(runKm, units))}
                unit={distanceUnit(units)}
              />
              <StatTile label="Longest streak" value={formatInt(streak)} unit={streak === 1 ? 'day' : 'days'} />
            </div>
          </StaggerItem>

          {matches.length > 0 && (
            <StaggerItem>
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
            </StaggerItem>
          )}
        </div>
        <div className="split__col">
          <StaggerItem>
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
          </StaggerItem>

          {!isMonth && (
            <>
              <section className="section" aria-labelledby="calendar-title">
                <h2 id="calendar-title" className="t-title-sm">
                  Training calendar
                </h2>
                <div className="pl-card">
                  <MonthHeatmap
                    month={month}
                    today={today}
                    heat={heat}
                    goalMin={goalMin}
                    selected={selected}
                    onSelect={setSelected}
                    onShift={shiftMonth}
                  />
                </div>
                <DayList
                  date={fromDateKey(selected)}
                  today={today}
                  items={selectedItems}
                  units={units}
                  onDelete={onDelete}
                  onLog={onLog}
                />
              </section>
            </>
          )}
        </div>
      </Stagger>
    </>
  );
};

export default ProgressView;
