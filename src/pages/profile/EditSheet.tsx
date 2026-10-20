import { IonInput } from '@ionic/react';
import { useEffect, useState } from 'react';
import { Button, Chip, Segmented, Sheet, Stepper } from '../../components';
import type { ProfilePatch } from '../../data/profile';
import type { ProfileRow } from '../../lib/database.types';
import { formatInt } from '../../lib/format';
import { FOCUS_OPTIONS, type EditField } from '../../lib/profile';

const TITLES: Record<EditField, string> = {
  display_name: 'Your name',
  workouts_per_week: 'Workouts per week',
  move_goal_kcal: 'Daily move goal',
  active_goal_min: 'Daily active time',
  main_focus: 'Main focus',
  units: 'Units',
};

const UNIT_OPTIONS = ['Metric', 'Imperial'] as const;

export interface EditSheetProps {
  field: EditField | null;
  profile: ProfileRow;
  onDismiss: () => void;
  onSave: (patch: ProfilePatch) => Promise<void>;
}

/** Edits one profile value: a stepper, choices or a name field. */
const EditSheet: React.FC<EditSheetProps> = ({ field, profile, onDismiss, onSave }) => {
  const [num, setNum] = useState(0);
  const [text, setText] = useState('');
  const [units, setUnits] = useState<(typeof UNIT_OPTIONS)[number]>('Metric');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!field) return;
    setError(null);
    if (field === 'workouts_per_week' || field === 'move_goal_kcal' || field === 'active_goal_min') setNum(profile[field]);
    if (field === 'main_focus') setText(profile.main_focus);
    if (field === 'display_name') setText(profile.display_name ?? '');
    if (field === 'units') setUnits(profile.units === 'imperial' ? 'Imperial' : 'Metric');
  }, [field, profile]);

  if (!field) return null;

  const patch = (): ProfilePatch => {
    switch (field) {
      case 'display_name':
        return { display_name: text.trim() || null };
      case 'main_focus':
        return { main_focus: text };
      case 'units':
        return { units: units === 'Imperial' ? 'imperial' : 'metric' };
      default:
        return { [field]: num };
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(patch());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet isOpen onDismiss={onDismiss} labelledBy="edit-title">
      <h2 id="edit-title" className="t-title-md">
        {TITLES[field]}
      </h2>

      {field === 'display_name' && (
        <label className="field">
          <span className="field__label">Shown on your profile</span>
          <span className="field__control">
            <IonInput
              aria-label="Name"
              autocomplete="name"
              maxlength={60}
              value={text}
              onIonInput={(e) => setText(String(e.detail.value ?? ''))}
            />
          </span>
        </label>
      )}

      {field === 'workouts_per_week' && (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="t-cap">Days per week</span>
          <Stepper name="workouts per week" value={num} step={1} min={1} max={7} onChange={setNum} />
        </div>
      )}
      {field === 'move_goal_kcal' && (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="t-cap">Burned per day (kcal)</span>
          <Stepper name="daily move goal" value={num} step={50} min={100} max={3000} onChange={setNum} format={formatInt} />
        </div>
      )}
      {field === 'active_goal_min' && (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="t-cap">Active minutes per day</span>
          <Stepper name="daily active time" value={num} step={5} min={5} max={300} onChange={setNum} />
        </div>
      )}

      {field === 'main_focus' && (
        <div className="profile-choices" role="group" aria-label="Main focus">
          {FOCUS_OPTIONS.map((o) => (
            <Chip key={o} label={o} selected={text === o} onSelect={() => setText(o)} />
          ))}
        </div>
      )}

      {field === 'units' && (
        <>
          <Segmented label="Units" options={UNIT_OPTIONS} value={units} onChange={setUnits} />
          <p className="t-cap">
            {units === 'Metric' ? 'Weights in kg, distances in km and m.' : 'Weights in lb, distances in mi and yd.'} Machine
            loads stay in PL.
          </p>
        </>
      )}

      {error && (
        <p className="t-cap" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      <div className="section">
        <Button variant="primary" size="lg" block disabled={saving} onClick={save}>
          Save
        </Button>
        <Button variant="ghost" block onClick={onDismiss}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
};

export default EditSheet;
