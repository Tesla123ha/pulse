import { useEffect, useState } from 'react';

export interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  /** Accessible name, e.g. "Set 2 weight". */
  label: string;
  /** Unit shown after the field: "kg", "PL", "reps". */
  suffix?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Compact typed number, for dense rows where a full stepper does not fit. */
const NumberField: React.FC<NumberFieldProps> = ({ value, onChange, label, suffix, min = 0, max = 10000, disabled }) => {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const n = Number(text.replace(/,/g, '').trim());
    const next = text.trim() !== '' && Number.isFinite(n) ? Math.min(max, Math.max(min, round2(n))) : value;
    if (next !== value) onChange(next);
    setText(String(next));
  };

  return (
    <span className="pl-numfield">
      <input
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        aria-label={label}
        disabled={disabled}
        value={text}
        onFocus={(e) => {
          setEditing(true);
          e.currentTarget.select();
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      {suffix && <span className="pl-numfield__suffix">{suffix}</span>}
    </span>
  );
};

export default NumberField;
