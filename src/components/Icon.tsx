// Outline icons on a 24px grid, 2px stroke, round caps and joins (Pulse iconography).
// Paths are taken from the Pulse design system and redesign artboards.
import type { ReactNode } from 'react';

const paths = {
  home: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  workouts: <path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />,
  nutrition: (
    <>
      <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10" />
      <path d="M17 21V3c-2.5 1.5-4 4-4 7.5V14h4" />
    </>
  ),
  progress: <path d="M5 20v-7M12 20V5M19 20v-11" />,
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
      <path d="M10 21h4" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  run: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  cycle: (
    <>
      <circle cx="6" cy="16" r="3.5" />
      <circle cx="18" cy="16" r="3.5" />
      <path d="M6 16l4-8h5l3 8M10 8l4 8" />
    </>
  ),
  sport: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18" />
    </>
  ),
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  mobility: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 8v6M6 10l6 2 6-2M9 21l3-7 3 7" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  scan: (
    <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 9v6M12 9v6M16 9v6" />
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  pause: <path d="M9 5v14M15 5v14" />,
  play: <path d="M7 5l12 7-12 7z" />,
  swap: <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  skip: <path d="M5 5l9 7-9 7zM18 5v14" />,
  pencil: <path d="M4 20l4-1L19 8l-3-3L5 16z" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

interface IconProps {
  name: IconName;
  /** Pixel size; defaults to size-icon (24px). */
  size?: number;
  strokeWidth?: number;
  /** When set, the icon is meaningful and announced; otherwise it is decorative. */
  label?: string;
  className?: string;
}

const Icon: React.FC<IconProps> = ({ name, size, strokeWidth, label, className }) => (
  <svg
    className={`pl-ico${className ? ` ${className}` : ''}`}
    viewBox="0 0 24 24"
    style={{
      width: size,
      height: size,
      strokeWidth,
    }}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
  >
    {paths[name]}
  </svg>
);

export default Icon;
