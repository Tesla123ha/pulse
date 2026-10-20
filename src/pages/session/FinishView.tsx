import { Button, Card, ScrimFade, SheetRise, StatTile } from '../../components';
import type { SessionData } from '../../data/session';
import { formatInt } from '../../lib/format';
import { buildModel, elapsedSeconds, exerciseCaption, finishMessage, formatClock } from '../../lib/session';
import { SessionHeader } from './SessionView';

export interface FinishViewProps {
  data: SessionData;
  now: Date;
  busy: boolean;
  error: string | null;
  onKeepGoing: () => void;
  onEnd: () => void;
}

/** Finish confirmation: the session dimmed behind a bottom sheet. */
const FinishView: React.FC<FinishViewProps> = ({ data, now, busy, error, onKeepGoing, onEnd }) => {
  const model = buildModel(data.session, data.exercises, data.sets);
  const clock = formatClock(elapsedSeconds(data.session, now));
  const shownExercise = model.current ?? model.order[model.order.length - 1];

  return (
    <>
      <div className="screen finish-behind" aria-hidden="true">
        <SessionHeader title={data.workout.name} caption={exerciseCaption(model)} />
        <div className="session-clock" style={{ marginTop: 'var(--space-4)' }}>
          <span className="t-display-xl">{clock}</span>
          <span className="t-cap">Elapsed</span>
        </div>
        <Card level="raised" style={{ height: 260 }}>
          <div className="t-title-md">{shownExercise?.name}</div>
        </Card>
      </div>

      <ScrimFade className="finish-scrim" aria-hidden="true" />

      <SheetRise className="finish-sheet" role="dialog" aria-modal="true" aria-labelledby="finish-title">
        <span className="finish-sheet__handle" aria-hidden="true" />
        <div>
          <h1 id="finish-title" className="t-title-md">
            {model.allDone ? 'Finish workout?' : 'End workout?'}
          </h1>
          <p className="t-secondary" style={{ marginTop: 'var(--space-2)' }}>
            {finishMessage(data.session, data.exercises, data.sets)}
          </p>
        </div>
        <div className="pl-stat-grid">
          <StatTile overlay label="Elapsed" value={clock} />
          <StatTile
            overlay
            label="Exercise"
            value={formatInt(model.currentNumber)}
            unit={`of ${formatInt(model.order.length)}`}
          />
        </div>
        {error && (
          <p className="t-cap" role="alert" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        <div className="finish-sheet__actions">
          {model.allDone ? (
            <>
              <Button variant="primary" size="lg" block disabled={busy} onClick={onEnd}>
                Finish workout
              </Button>
              <Button variant="ghost" block disabled={busy} onClick={onKeepGoing}>
                Back to workout
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" size="lg" block disabled={busy} onClick={onKeepGoing}>
                Keep going
              </Button>
              <Button variant="danger" block disabled={busy} onClick={onEnd}>
                End workout
              </Button>
            </>
          )}
        </div>
      </SheetRise>
    </>
  );
};

export default FinishView;
