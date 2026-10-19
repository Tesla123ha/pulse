import { useEffect, useState } from 'react';

export interface ProgressBarProps {
  /** 0 to 1. */
  value: number;
  label: string;
  /** Fill color token. Lime by default; macros pass their data-* token. */
  color?: string;
}

/** 8px pill progress bar. Lime fill means progress toward a goal. */
const ProgressBar: React.FC<ProgressBarProps> = ({ value, label, color }) => {
  const clamped = Math.max(0, Math.min(1, value));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);
  return (
    <div
      className="pl-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div className="pl-bar__fill" style={{ width: `${shown * 100}%`, background: color }} />
    </div>
  );
};

export default ProgressBar;
