import { ListRow, Sheet } from '../../components';
import { QUICK_LOG, type ActivityMeta } from '../../lib/activity';
import { formatHeaderDate, fromDateKey } from '../../lib/dates';

export interface LogDaySheetProps {
  day: string | null;
  onDismiss: () => void;
  onWorkout: (day: string) => void;
  onActivity: (day: string, activity: ActivityMeta) => void;
}

/** Choose what to add to a day: a full gym workout or a quick-log activity. */
const LogDaySheet: React.FC<LogDaySheetProps> = ({ day, onDismiss, onWorkout, onActivity }) => {
  if (!day) return null;
  return (
    <Sheet isOpen onDismiss={onDismiss} labelledBy="logday-title">
      <div>
        <h2 id="logday-title" className="t-title-md">
          Log activity
        </h2>
        <p className="t-cap">{formatHeaderDate(fromDateKey(day))}</p>
      </div>
      <div className="progress-list">
        <ListRow icon="workouts" title="Gym workout" caption="Every set, by exercise" onClick={() => onWorkout(day)} />
        {QUICK_LOG.map((a) => (
          <ListRow key={a.type} icon={a.icon} title={a.noun.charAt(0).toUpperCase() + a.noun.slice(1)} onClick={() => onActivity(day, a)} />
        ))}
      </div>
    </Sheet>
  );
};

export default LogDaySheet;
