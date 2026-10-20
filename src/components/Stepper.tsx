import { useEffect, useRef, useState } from 'react';
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
  /** Reads typed text back into a value; null when it is not a valid entry. Defaults to plain numbers. */
  parse?: (text: string) => number | null;
  /** Keyboard to show when typing. Pace needs "text" for the colon. */
  inputMode?: 'decimal' | 'numeric' | 'text';
  width?: number;
}

/** "1,500" -> 1500, "5.25" -> 5.25; commas are thousands separators. */
const parseNumber = (text: string) => {
  const n = Number(text.replace(/,/g, '').trim());
  return text.trim() !== '' && Number.isFinite(n) ? n : null;
};

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Minus and plus around a value you can also type. 48px buttons, numeric-lg value.
 * Typing applies valid values as you go and tidies the field when you leave it.
 */
const Stepper: React.FC<StepperProps> = ({
  value,
  onChange,
  step,
  min = 0,
  max = Infinity,
  name,
  format,
  parse = parseNumber,
  inputMode = 'decimal',
  width = 176,
}) => {
  const show = (v: number) => (format ? format(v) : String(v));
  const [text, setText] = useState(show(value));
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);

  // Follow the value (buttons, presets) except while the person is typing.
  useEffect(() => {
    if (!editing) setText(format ? format(value) : String(value));
  }, [value, editing, format]);

  const clamp = (v: number) => Math.min(max, Math.max(min, round2(v)));
  const set = (v: number) => onChange(clamp(v));

  const commit = () => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      setText(show(value));
      return;
    }
    const parsed = parse(text);
    const next = parsed === null ? value : clamp(parsed);
    if (next !== value) onChange(next);
    setText(show(next));
  };

  return (
    <div className="pl-stepper" style={{ width }}>
      <Button iconOnly aria-label={`Decrease ${name}`} disabled={value <= min} onClick={() => set(value - step)}>
        <Icon name="minus" />
      </Button>
      <input
        className="pl-stepper__val pl-stepper__input"
        type="text"
        inputMode={inputMode}
        enterKeyHint="done"
        autoComplete="off"
        aria-label={name.charAt(0).toUpperCase() + name.slice(1)}
        value={text}
        onFocus={(e) => {
          setEditing(true);
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parse(e.target.value);
          if (parsed !== null && parsed >= min && parsed <= max) onChange(round2(parsed));
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
      />
      <Button iconOnly aria-label={`Increase ${name}`} disabled={value >= max} onClick={() => set(value + step)}>
        <Icon name="plus" />
      </Button>
    </div>
  );
};

export default Stepper;
