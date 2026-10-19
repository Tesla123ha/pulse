import Button from './Button';
import Icon from './Icon';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  step: number;
  min?: number;
  max?: number;
  /** Used in accessible names: "Decrease weight". */
  name: string;
  format?: (value: number) => string;
  width?: number;
}

/** Minus and plus around a value. 48px buttons, numeric-lg value. */
const Stepper: React.FC<StepperProps> = ({ value, onChange, step, min = 0, max = Infinity, name, format, width = 176 }) => {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  return (
    <div className="pl-stepper" style={{ width }}>
      <Button iconOnly aria-label={`Decrease ${name}`} disabled={value <= min} onClick={() => set(value - step)}>
        <Icon name="minus" />
      </Button>
      <span className="pl-stepper__val" aria-live="polite" aria-label={`${name} ${value}`}>
        {format ? format(value) : value}
      </span>
      <Button iconOnly aria-label={`Increase ${name}`} disabled={value >= max} onClick={() => set(value + step)}>
        <Icon name="plus" />
      </Button>
    </div>
  );
};

export default Stepper;
