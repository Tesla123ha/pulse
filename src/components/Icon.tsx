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
  swim: (
    <>
      <circle cx="17" cy="6" r="2" />
      <path d="M5 13l4-4 3 2 3-3" />
      <path d="M3 18c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" />
    </>
  ),
  pickleball: (
    <>
      <rect x="4" y="2" width="11" height="13" rx="5.5" />
      <path d="M9.5 15v6" />
      <circle cx="19" cy="18" r="2" />
    </>
  ),
  tennis: (
    <>
      <ellipse cx="10" cy="9" rx="6" ry="7" />
      <path d="M6 9h8M10 2v14M14 14l6 7" />
    </>
  ),
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
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  pause: <path d="M9 5v14M15 5v14" />,
  play: <path d="M7 5l12 7-12 7z" />,
  swap: <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  skip: <path d="M5 5l9 7-9 7zM18 5v14" />,
  pencil: <path d="M4 20l4-1L19 8l-3-3L5 16z" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  wallet: (
    <>
      <path d="M4 7a2 2 0 0 1 2-2h12v4" />
      <path d="M4 7v11a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2z" />
      <circle cx="16" cy="14.5" r="1" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9v.01M18 15v.01" />
    </>
  ),
  bank: <path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />,
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  savings: (
    <>
      <path d="M5 11a7 6 0 0 1 13-2h2v4l-2 1v3h-3v-2H9v2H6v-3a5 5 0 0 1-1-3z" />
      <path d="M10 7.5h3" />
    </>
  ),
  dots: <path d="M6 12h.01M12 12h.01M18 12h.01" />,
  food: (
    <>
      <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10" />
      <path d="M17 21V3c-2.5 1.5-4 4-4 7.5V14h4" />
    </>
  ),
  car: (
    <>
      <path d="M5 16V11l2-5h10l2 5v5" />
      <path d="M3 16h18v3H3zM5 11h14" />
      <path d="M7 19v1M17 19v1" />
    </>
  ),
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3" />,
  bag: (
    <>
      <path d="M5 8h14l-1 13H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  ticket: <path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v2M14 11v2M14 15v2" />,
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5h6v2M3 12h18" />
    </>
  ),
  store: <path d="M4 10l1-6h14l1 6M4 10a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5 10v10h14V10M10 20v-5h4v5" />,
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" />
      <path d="M5 12v9h14v-9M12 8v13M12 8C10 4 6 5 8 8M12 8c2-4 6-3 4 0" />
    </>
  ),
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
