import { IonButton } from '@ionic/react';
import { m } from 'motion/react';
import type { ComponentProps, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'stop' | 'danger' | 'plain';

type IonButtonProps = ComponentProps<typeof IonButton>;

export interface ButtonProps extends Omit<IonButtonProps, 'color' | 'fill' | 'size' | 'expand' | 'shape'> {
  /** One `primary` per screen. Default `secondary`. */
  variant?: ButtonVariant;
  /** `lg` (56px) for the screen's main action. */
  size?: 'md' | 'lg';
  block?: boolean;
  /** Square icon-only button. Requires `aria-label`. */
  iconOnly?: boolean;
  /** Spring hover and press feedback, on by default. Pass false to opt out. Scaling is skipped for reduced motion. */
  feedback?: boolean;
  children?: ReactNode;
}

const MotionIonButton = m.create(IonButton);
const PRESS_SPRING = { type: 'spring', stiffness: 520, damping: 32 } as const;
// Motion types these handlers differently from React's DOM versions; Pulse never passes them to a Button
type MotionClashes = 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart';

const HOVER = { scale: 1.03 };
// Full-width buttons would grow past their card's padding, so they scale less
const HOVER_BLOCK = { scale: 1.01 };
const TAP = { scale: 0.97 };

const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  block,
  iconOnly,
  feedback = true,
  className,
  children,
  ...rest
}) => {
  if (import.meta.env.DEV && iconOnly && !rest['aria-label']) {
    console.warn('Pulse Button: icon-only buttons need an aria-label.');
  }
  const cls = [
    'pl-btn',
    `pl-btn--${variant}`,
    size === 'lg' && 'pl-btn--lg',
    block && 'pl-btn--block',
    iconOnly && 'pl-btn--icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const content = <span className="pl-btn__inner">{children}</span>;
  if (feedback) {
    return (
      <MotionIonButton
        {...(rest as Omit<typeof rest, MotionClashes>)}
        fill="clear"
        className={cls}
        whileHover={block ? HOVER_BLOCK : HOVER}
        whileTap={TAP}
        transition={PRESS_SPRING}
      >
        {content}
      </MotionIonButton>
    );
  }
  return (
    <IonButton {...rest} fill="clear" className={cls}>
      {content}
    </IonButton>
  );
};

export default Button;
