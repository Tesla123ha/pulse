import { useEffect, useState } from 'react';
import { Button, Chip, Segmented, Sheet, Stepper } from '../../components';
import type { NewActivity } from '../../data/home';
import {
  estimateKcal,
  formatPace,
  kmToSwim,
  paceFromDisplay,
  paceToDisplay,
  paceUnit,
  parsePace,
  swimToKm,
  swimUnit,
  type ActivityMeta,
} from '../../lib/activity';
import type { ActivityLogRow, Units } from '../../lib/database.types';
import { formatDecimal2, formatInt } from '../../lib/format';
import { formatClock } from '../../lib/session';
import { formatShortDate, fromDateKey, middayOf } from '../../lib/dates';
import { displayToKm, distanceUnit, kmToDisplay } from '../../lib/units';

export interface QuickLogSheetProps {
  activity: ActivityMeta | null;
  last: ActivityLogRow | undefined;
  units: Units;
  onDismiss: () => void;
  onSave: (v: NewActivity) => Promise<void>;
  /** YYYY-MM-DD of a past day to log to; omitted logs it now. */
  day?: string;
}

const VENUES = ['Pool', 'Open water'] as const;
const MATCH_TYPES = ['Singles', 'Doubles'] as const;
const RUN_PRESETS_KM = [3, 5, 10];

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="row" style={{ justifyContent: 'space-between' }}>
    <span className="t-cap">{label}</span>
    {children}
  </div>
);

/** Bottom sheet that logs one activity, prefilled with the last entry of that type. */
const QuickLogSheet: React.FC<QuickLogSheetProps> = ({ activity, last, units, onDismiss, onSave, day }) => {
  const [minutes, setMinutes] = useState(30);
  const [distance, setDistance] = useState(0); // display units: km/mi for runs, m/yd for swims
  const [pace, setPace] = useState(330); // display seconds per km or mile
  const [venue, setVenue] = useState<(typeof VENUES)[number]>('Pool');
  const [matchType, setMatchType] = useState<(typeof MATCH_TYPES)[number]>('Singles');
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activity) return;
    setError(null);
    setMinutes(last?.duration_min ?? activity.defaultMinutes);
    if (activity.kind === 'run') {
      const km = Number(last?.distance_km ?? 5);
      setDistance(Math.round(kmToDisplay(km, units) * 10) / 10);
      setPace(Math.round(paceToDisplay(last?.pace_sec_per_km ?? 330, units) / 5) * 5);
    }
    if (activity.kind === 'swim') {
      const km = Number(last?.distance_km ?? 1);
      setDistance(Math.round(kmToSwim(km, units) / 50) * 50);
      setVenue(last?.venue === 'open_water' ? 'Open water' : 'Pool');
    }
    if (activity.kind === 'match') {
      setMatchType(last?.match_type === 'doubles' ? 'Doubles' : 'Singles');
      setWins(0);
      setLosses(0);
    }
  }, [activity, last, units]);

  if (!activity) return null;

  // Runs derive duration from distance and pace.
  const runSeconds = activity.kind === 'run' ? distance * pace : 0;
  const durationMin = activity.kind === 'run' ? Math.max(1, Math.round(runSeconds / 60)) : minutes;
  const kcal = estimateKcal(activity.type, durationMin);
  const label = activity.noun;

  const payload = (): NewActivity => {
    const base = { type: activity.type, durationMin, kcal, loggedAt: day ? middayOf(day).toISOString() : undefined };
    if (activity.kind === 'run') {
      const km = Math.round(displayToKm(distance, units) * 100) / 100;
      return { ...base, distanceKm: km, paceSecPerKm: Math.round(paceFromDisplay(pace, units)) };
    }
    if (activity.kind === 'swim') {
      return {
        ...base,
        distanceKm: Math.round(swimToKm(distance, units) * 1000) / 1000,
        venue: venue === 'Pool' ? 'pool' : 'open_water',
      };
    }
    if (activity.kind === 'match') {
      return { ...base, matchType: matchType === 'Singles' ? 'singles' : 'doubles', wins, losses };
    }
    return base;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(payload());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const summary =
    activity.kind === 'run'
      ? `${formatClock(Math.round(runSeconds))} · About ${formatInt(kcal)} kcal burned`
      : `About ${formatInt(kcal)} kcal burned`;
  const when = day ? `${formatShortDate(fromDateKey(day))} · ` : '';

  return (
    <Sheet isOpen onDismiss={onDismiss} labelledBy="quicklog-title">
      <div>
        <h2 id="quicklog-title" className="t-title-md">
          Log {label}
        </h2>
        <p className="t-cap">
          {when}
          {summary}
        </p>
      </div>

      {activity.kind === 'run' && (
        <>
          <Row label={`Distance (${distanceUnit(units)})`}>
            <Stepper name="distance" value={distance} step={0.5} min={0.5} max={200} onChange={setDistance} format={formatDecimal2} />
          </Row>
          {units === 'metric' && (
            <div className="row" style={{ gap: 'var(--space-2)' }} role="group" aria-label="Distance presets">
              {RUN_PRESETS_KM.map((km) => (
                <Chip key={km} label={`${km}k`} selected={distance === km} onSelect={() => setDistance(km)} />
              ))}
            </div>
          )}
          <Row label={`Pace (${paceUnit(units)})`}>
            <Stepper
              name="pace"
              value={pace}
              step={5}
              min={120}
              max={1200}
              onChange={setPace}
              format={formatPace}
              parse={parsePace}
              inputMode="text"
            />
          </Row>
        </>
      )}

      {activity.kind === 'swim' && (
        <>
          <Segmented label="Where" options={VENUES} value={venue} onChange={setVenue} />
          <Row label={`Distance (${swimUnit(units)})`}>
            <Stepper name="distance" value={distance} step={50} min={50} max={20000} onChange={setDistance} format={formatInt} />
          </Row>
        </>
      )}

      {activity.kind === 'match' && (
        <>
          <Segmented label="Type" options={MATCH_TYPES} value={matchType} onChange={setMatchType} />
          <Row label="Won">
            <Stepper name="games won" value={wins} step={1} min={0} max={99} onChange={setWins} />
          </Row>
          <Row label="Lost">
            <Stepper name="games lost" value={losses} step={1} min={0} max={99} onChange={setLosses} />
          </Row>
        </>
      )}

      {activity.kind !== 'run' && (
        <Row label="Duration (min)">
          <Stepper name="duration" value={minutes} step={5} min={5} max={600} onChange={setMinutes} />
        </Row>
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
    </Sheet>
  );
};

export default QuickLogSheet;
