import { IonButton } from '@ionic/react';

export interface ChipProps {
  label: string;
  selected: boolean;
  onSelect: () => void;
}

/** Filter pill. Selected fills with `text`, never lime. */
export const Chip: React.FC<ChipProps> = ({ label, selected, onSelect }) => (
  <IonButton
    fill="clear"
    className={`pl-chip${selected ? ' pl-chip--selected' : ''}`}
    aria-pressed={selected}
    onClick={onSelect}
  >
    {label}
  </IonButton>
);

export interface ChipRowProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

/** Horizontally scrolling row of chips with a faded right edge and no scrollbar. */
export function ChipRow<T extends string>({ options, value, onChange, label }: ChipRowProps<T>) {
  return (
    <div className="pl-chip-row" role="group" aria-label={label}>
      {options.map((o) => (
        <Chip key={o} label={o} selected={o === value} onSelect={() => onChange(o)} />
      ))}
    </div>
  );
}

export default Chip;
