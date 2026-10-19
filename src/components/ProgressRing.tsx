import { useEffect, useState } from 'react';

const R = 52;
const CIRC = 2 * Math.PI * R; // 326.7

export interface ProgressRingProps {
  /** 0 to 1. Values above 1 draw a full ring. */
  value: number;
  /** Accessible description, e.g. "70 percent of daily move goal". */
  label: string;
  /** Diameter in px. Defaults to size-ring (120px). */
  size?: number;
}

/** Circular progress toward a daily goal. Pair it with the exact numbers beside it. */
const ProgressRing: React.FC<ProgressRingProps> = ({ value, label, size }) => {
  const clamped = Math.max(0, Math.min(1, value));
  // Fill from empty on first view (CSS transition; reduced motion skips it).
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  return (
    <div className="pl-ring" style={size ? { width: size, height: size } : undefined} role="img" aria-label={label}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="pl-ring__track" cx="60" cy="60" r={R} />
        {clamped > 0 && (
          <circle
            className="pl-ring__fill"
            cx="60"
            cy="60"
            r={R}
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - shown)}
          />
        )}
      </svg>
      <div className="pl-ring__label" aria-hidden="true">
        {Math.round(clamped * 100)}%
      </div>
    </div>
  );
};

export default ProgressRing;
