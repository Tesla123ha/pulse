import Icon from './Icon';

export type DayStatus = 'done' | 'missed' | 'today' | 'today-done' | 'upcoming';

export interface WeekDay {
  /** Weekday letter shown under the dot. */
  letter: string;
  /** Full name for screen readers, e.g. "Wednesday". */
  name: string;
  status: DayStatus;
}

const statusText: Record<DayStatus, string> = {
  done: 'active',
  missed: 'rest day',
  today: 'not yet active',
  'today-done': 'active',
  upcoming: 'upcoming',
};

/** Seven-day strip. Done: lime with a check. Missed: neutral with a dash. Today: lime ring. */
const WeekStrip: React.FC<{ days: WeekDay[] }> = ({ days }) => (
  <ul className="pl-week">
    {days.map((d, i) => {
      const isToday = d.status === 'today' || d.status === 'today-done';
      const done = d.status === 'done' || d.status === 'today-done';
      return (
        <li key={i} className="pl-day" aria-current={isToday ? 'date' : undefined}>
          <span
            className={`pl-dot${done ? ' pl-dot--done' : ''}${d.status === 'today' ? ' pl-dot--today' : ''}${
              d.status === 'upcoming' ? ' pl-dot--upcoming' : ''
            }`}
            role="img"
            aria-label={`${isToday ? 'Today' : d.name}, ${statusText[d.status]}`}
          >
            {done && <Icon name="check" />}
            {d.status === 'missed' && <Icon name="minus" />}
          </span>
          <span aria-hidden="true">{d.letter}</span>
        </li>
      );
    })}
  </ul>
);

export default WeekStrip;
