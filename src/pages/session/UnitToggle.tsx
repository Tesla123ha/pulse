import { Segmented } from '../../components';
import { choiceLabel, isChoice, LOAD_CHOICES, type LoadChoice } from '../../lib/load';

const LABELS = LOAD_CHOICES.map(choiceLabel);

/** KG | LB | PL for one exercise. The selected segment fills with `text`, never lime. */
const UnitToggle: React.FC<{
  exercise: string;
  value: LoadChoice;
  onChange: (c: LoadChoice) => void;
}> = ({ exercise, value, onChange }) => (
  <div className="unit-toggle">
    <Segmented
      options={LABELS}
      value={choiceLabel(value)}
      label={`${exercise} weight unit`}
      onChange={(l) => {
        const c = l.toLowerCase();
        if (isChoice(c)) onChange(c);
      }}
    />
  </div>
);

export default UnitToggle;
