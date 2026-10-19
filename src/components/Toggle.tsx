import { IonToggle } from '@ionic/react';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label text, also the accessible name. */
  label: string;
}

/** Switch row control: 52 x 32 visible, 44px hit area. */
const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label }) => (
  <IonToggle
    className="pl-toggle"
    checked={checked}
    justify="space-between"
    labelPlacement="start"
    onIonChange={(e) => onChange(e.detail.checked)}
  >
    {label}
  </IonToggle>
);

export default Toggle;
