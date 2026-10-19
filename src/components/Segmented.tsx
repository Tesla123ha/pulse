import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/react';

export interface SegmentedProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the tablist, e.g. "Time range". */
  label: string;
}

/** Mutually exclusive range switch. The selected segment fills with `text`. */
function Segmented<T extends string>({ options, value, onChange, label }: SegmentedProps<T>) {
  return (
    <IonSegment
      className="pl-seg"
      mode="ios"
      value={value}
      aria-label={label}
      onIonChange={(e) => {
        const v = e.detail.value;
        if (typeof v === 'string' && (options as readonly string[]).includes(v)) onChange(v as T);
      }}
    >
      {options.map((o) => (
        <IonSegmentButton key={o} value={o}>
          <IonLabel>{o}</IonLabel>
        </IonSegmentButton>
      ))}
    </IonSegment>
  );
}

export default Segmented;
