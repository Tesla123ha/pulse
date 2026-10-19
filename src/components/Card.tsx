import type { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `surface` (default), `raised` (hero and sheets), `active` (the current set, lime border). */
  level?: 'surface' | 'raised' | 'active';
  /** Hero cards pad with space-5 instead of space-4. */
  hero?: boolean;
  /** radius-xl, for the single hero block of a screen. */
  xl?: boolean;
  /** No padding; for cards that hold full-width rows. */
  flush?: boolean;
  as?: 'div' | 'section' | 'article';
}

const Card: React.FC<CardProps> = ({ level = 'surface', hero, xl, flush, as: Tag = 'div', className, ...rest }) => {
  const cls = [
    'pl-card',
    level === 'raised' && 'pl-card--raised',
    level === 'active' && 'pl-card--active',
    hero && 'pl-card--hero',
    xl && 'pl-card--xl',
    flush && 'pl-card--flush',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <Tag className={cls} {...rest} />;
};

export default Card;
