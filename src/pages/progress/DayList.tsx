import { Button, Icon, ListRow } from '../../components';
import type { ProgressActivity } from '../../data/progress';
import { activityMeta } from '../../lib/activity';
import { addDays, dateKey } from '../../lib/dates';
import type { Units } from '../../lib/database.types';
import { formatInt } from '../../lib/format';
import { activityDetail, activityTitle } from '../../lib/progress';

const DAY_TITLE = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const DAY_LABEL = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });

const dayHeading = (d: Date, today: Date) =>
  dateKey(d) === dateKey(today) ? 'Today' : dateKey(d) === dateKey(addDays(today, -1)) ? 'Yesterday' : DAY_TITLE.format(d);

/** What was logged on the selected day, with a way to add more or delete. */
const DayList: React.FC<{
  date: Date;
  today: Date;
  items: ProgressActivity[];
  units: Units;
  onDelete: (a: ProgressActivity) => void;
  onLog: (day: string) => void;
}> = ({ date, today, items, units, onDelete, onLog }) => {
  const minutes = items.reduce((s, a) => s + a.duration_min, 0);
  return (
    <div className="section" aria-live="polite">
      <div className="sec-head">
        <div>
          <h3 className="t-cap">{dayHeading(date, today)}</h3>
          {items.length > 0 && (
            <p className="t-cap t-muted">
              {formatInt(minutes)} min, {items.length} {items.length === 1 ? 'activity' : 'activities'}
            </p>
          )}
        </div>
        <Button variant="plain" className="cal__log" onClick={() => onLog(dateKey(date))}>
          <Icon name="plus" size={20} />
          Log activity
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="t-cap t-muted">No activity logged.</p>
      ) : (
        [...items].reverse().map((a) => (
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
                  aria-label={`Delete ${activityTitle(a)} on ${DAY_LABEL.format(date)}`}
                  onClick={() => onDelete(a)}
                >
                  <Icon name="trash" />
                </Button>
              </span>
            }
          />
        ))
      )}
    </div>
  );
};

export default DayList;
