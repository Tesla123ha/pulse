import { Button, Icon } from '../../components';
import { dateKey } from '../../lib/dates';
import { formatInt } from '../../lib/format';
import { heatLabel, type HeatCell, type MonthHeatmap as Heat } from '../../lib/progress';

const MONTH_TITLE = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Month grid shaded by active minutes, with month navigation and a legend. Presentational. */
const MonthHeatmap: React.FC<{
  month: Date;
  today: Date;
  heat: Heat;
  goalMin: number;
  selected: string;
  onSelect: (key: string) => void;
  onShift: (n: number) => void;
  /** Shown under the grid when the month has no activity. */
  emptyText?: string;
}> = ({ month, today, heat, goalMin, selected, onSelect, onShift, emptyText }) => {
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const todayKey = dateKey(today);
  const title = MONTH_TITLE.format(month);

  const classFor = (c: HeatCell) =>
    ['cal__day', `cal__day--l${c.level}`, c.key === todayKey && 'cal__day--today', c.key === selected && 'cal__day--selected']
      .filter(Boolean)
      .join(' ');

  return (
    <div className="cal">
      <div className="cal__head">
        <p className="t-title-sm cal__title" aria-live="polite">
          {title}
        </p>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Button iconOnly aria-label="Previous month" onClick={() => onShift(-1)}>
            <Icon name="chevronLeft" />
          </Button>
          <Button iconOnly aria-label="Next month" disabled={isCurrentMonth} onClick={() => onShift(1)}>
            <Icon name="chevronRight" />
          </Button>
        </div>
      </div>
      <div className="cal__grid" role="grid" aria-label={title}>
        {WEEKDAYS.map((d, i) => (
          <span key={`h${i}`} className="cal__weekday" aria-hidden="true">
            {d}
          </span>
        ))}
        {heat.cells.map((c, i) =>
          c ? (
            <button
              key={c.key}
              type="button"
              className={classFor(c)}
              disabled={c.future}
              aria-pressed={c.key === selected}
              aria-label={heatLabel(c)}
              onClick={() => onSelect(c.key)}
            >
              {c.date.getDate()}
            </button>
          ) : (
            <span key={`b${i}`} aria-hidden="true" />
          ),
        )}
      </div>
      {heat.activeDays === 0 && emptyText && <p className="t-cap cal__empty">{emptyText}</p>}
      <div className="cal__legend t-cap">
        <span className="cal__scale">
          Less
          <span aria-hidden="true" className="cal__swatches">
            {[0, 1, 2, 3].map((l) => (
              <span key={l} className={`cal__swatch cal__swatch--l${l}`} />
            ))}
          </span>
          More
        </span>
        {goalMin > 0 && <span>Goal {formatInt(goalMin)} min a day</span>}
      </div>
    </div>
  );
};

export default MonthHeatmap;
