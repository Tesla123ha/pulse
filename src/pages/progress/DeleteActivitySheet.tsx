import { useState } from 'react';
import { Button, Sheet } from '../../components';
import type { ProgressActivity } from '../../data/progress';
import { activityTitle } from '../../lib/progress';

const DAY = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

export interface DeleteActivitySheetProps {
  activity: ProgressActivity | null;
  onDismiss: () => void;
  onConfirm: (a: ProgressActivity) => Promise<void>;
}

/** Confirms deleting one logged activity, naming what goes with it. */
const DeleteActivitySheet: React.FC<DeleteActivitySheetProps> = ({ activity, onDismiss, onConfirm }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!activity) return null;

  const title = activityTitle(activity);
  const day = DAY.format(new Date(activity.logged_at));
  const isWorkout = Boolean(activity.session_id);
  const consequence = isWorkout
    ? `This removes the ${title} workout from ${day}, with every set you logged in it. Your plan, streak and Progress update. This cannot be undone.`
    : `This removes the ${title.toLowerCase()} from ${day}. Your streak and Progress update. This cannot be undone.`;

  return (
    <Sheet isOpen onDismiss={onDismiss} labelledBy="delete-title">
      <div>
        <h2 id="delete-title" className="t-title-md">
          Delete {isWorkout ? `${title} workout` : title.toLowerCase()}?
        </h2>
        <p className="t-secondary" style={{ marginTop: 'var(--space-2)' }}>
          {consequence}
        </p>
      </div>
      {error && (
        <p className="t-cap" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      <div className="section">
        <Button
          variant="danger"
          block
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onConfirm(activity);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Delete
        </Button>
        <Button variant="ghost" block disabled={busy} onClick={onDismiss}>
          Keep it
        </Button>
      </div>
    </Sheet>
  );
};

export default DeleteActivitySheet;
