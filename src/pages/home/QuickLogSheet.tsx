import { IonModal } from '@ionic/react';
import { useEffect, useState } from 'react';
import { Button, Stepper } from '../../components';
import { estimateKcal, type ActivityMeta } from '../../lib/activity';
import type { ActivityLogRow, Units } from '../../lib/database.types';
import { formatDecimal, formatInt } from '../../lib/format';
import { displayToKm, distanceUnit, kmToDisplay } from '../../lib/units';

export interface QuickLogSheetProps {
  activity: ActivityMeta | null;
  last: ActivityLogRow | undefined;
  units: Units;
  onDismiss: () => void;
  onSave: (v: { durationMin: number; distanceKm: number | null; kcal: number }) => Promise<void>;
}

/** Bottom sheet that logs one activity, prefilled with the last entry of that type. */
const QuickLogSheet: React.FC<QuickLogSheetProps> = ({ activity, last, units, onDismiss, onSave }) => {
  const [minutes, setMinutes] = useState(30);
  const [distance, setDistance] = useState(0); // display units
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activity) return;
    setMinutes(last?.duration_min ?? activity.defaultMinutes);
    const km = last?.distance_km ?? activity.defaultKm ?? 0;
    setDistance(Math.round(kmToDisplay(km, units) * 10) / 10);
    setError(null);
  }, [activity, last, units]);

  const kcal = activity ? estimateKcal(activity.type, minutes) : 0;
  const label = activity?.label.toLowerCase() ?? '';

  const save = async () => {
    if (!activity) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        durationMin: minutes,
        distanceKm: activity.hasDistance ? Math.round(displayToKm(distance, units) * 100) / 100 : null,
        kcal,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonModal
      className="pl-sheet"
      isOpen={activity !== null}
      onDidDismiss={onDismiss}
      initialBreakpoint={1}
      breakpoints={[0, 1]}
      aria-labelledby="quicklog-title"
    >
      {activity && (
        <div className="pl-sheet__body">
          <div>
            <h2 id="quicklog-title" className="t-title-md">
              Log {label}
            </h2>
            <p className="t-cap">About {formatInt(kcal)} kcal burned</p>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="t-cap">Duration (min)</span>
            <Stepper name="duration" value={minutes} step={5} min={5} max={600} onChange={setMinutes} />
          </div>
          {activity.hasDistance && (
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="t-cap">Distance ({distanceUnit(units)})</span>
              <Stepper
                name="distance"
                value={distance}
                step={0.5}
                min={0}
                max={500}
                onChange={setDistance}
                format={formatDecimal}
              />
            </div>
          )}
          {error && (
            <p className="t-cap" role="alert" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          <div className="section">
            <Button variant="primary" size="lg" block onClick={save} disabled={saving}>
              Log {label}
            </Button>
            <Button variant="ghost" block onClick={onDismiss}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </IonModal>
  );
};

export default QuickLogSheet;
