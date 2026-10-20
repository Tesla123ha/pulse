import { useMemo, useState } from 'react';
import { Button, Icon, ListRow } from '../../components';
import type { ProgressActivity } from '../../data/progress';
import { activityMeta } from '../../lib/activity';
import { addDays, dateKey, startOfDay } from '../../lib/dates';
import type { Units } from '../../lib/database.types';
import { formatInt } from '../../lib/format';
import { activityDetail, activityTitle } from '../../lib/progress';

const MONTH_TITLE = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const DAY_TITLE = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const DAY_LABEL = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Month grid of training days; tap a day to list what was logged. */
const TrainingCalendar: React.FC<{
  activity: ProgressActivity[];
  units: Units;
  now: Date;
  onDelete: (a: ProgressActivity) => void;
}> = ({ activity, units, now, onDelete }) => {
  const today = startOfDay(now);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() => dateKey(today));

  const byDay = useMemo(() => {
    const m = new Map<string, ProgressActivity[]>();
    for (const a of activity) {
      const k = dateKey(new Date(a.logged_at));
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return m;
  }, [activity]);

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: month.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  const [sy, sm, sd] = selected.split('-').map(Number);
  const selectedDate = new Date(sy, sm - 1, sd);
  const dayItems = [...(byDay.get(selected) ?? [])].reverse();

  return (
    <section className="section" aria-labelledby="calendar-title">
      <div className="sec-head">
        <h2 id="calendar-title" className="t-title-sm">
          Training calendar
        </h2>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Button iconOnly aria-label="Previous month" onClick={() => shift(-1)}>
            <Icon name="chevronLeft" />
          </Button>
          <Button iconOnly aria-label="Next month" disabled={isCurrentMonth} onClick={() => shift(1)}>
            <Icon name="chevronRight" />
          </Button>
        </div>
      </div>

      <div className="pl-card cal">
        <p className="t-title-sm cal__title" aria-live="polite">
          {MONTH_TITLE.format(month)}
        </p>
        <div className="cal__grid" role="grid" aria-label={MONTH_TITLE.format(month)}>
          {WEEKDAYS.map((d, i) => (
            <span key={`h${i}`} className="cal__weekday" aria-hidden="true">
              {d}
            </span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={`b${i}`} aria-hidden="true" />;
            const key = dateKey(d);
            const count = byDay.get(key)?.length ?? 0;
            const future = d > today;
            const cls = [
              'cal__day',
              count > 0 && 'cal__day--active',
              key === dateKey(today) && 'cal__day--today',
              key === selected && 'cal__day--selected',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={key}
                type="button"
                className={cls}
                disabled={future}
                aria-pressed={key === selected}
                aria-label={`${DAY_LABEL.format(d)}, ${count > 0 ? `${count} ${count === 1 ? 'activity' : 'activities'}` : 'no activity'}`}
                onClick={() => setSelected(key)}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      <div className="section" aria-live="polite">
        <h3 className="t-cap">{dayHeading(selectedDate, today)}</h3>
        {dayItems.length === 0 ? (
          <p className="t-cap t-muted">No activity logged.</p>
        ) : (
          dayItems.map((a) => {
            return (
              <ListRow
                key={a.id}
                icon={activityMeta(a.type).icon}
                title={activityTitle(a)}
                caption={activityDetail(a, units)}
                end={
                  <span className="pl-listrow__end">
                    {formatInt(a.kcal)} kcal
                    <Button
                      variant="stop"
                      iconOnly
                      aria-label={`Delete ${activityTitle(a)} on ${DAY_LABEL.format(selectedDate)}`}
                      onClick={() => onDelete(a)}
                    >
                      <Icon name="trash" />
                    </Button>
                  </span>
                }
              />
            );
          })
        )}
      </div>
    </section>
  );
};

const dayHeading = (d: Date, today: Date) =>
  dateKey(d) === dateKey(today) ? 'Today' : dateKey(d) === dateKey(addDays(today, -1)) ? 'Yesterday' : DAY_TITLE.format(d);

export default TrainingCalendar;
