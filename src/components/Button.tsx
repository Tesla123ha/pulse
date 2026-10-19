import { IonButton } from '@ionic/react';
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
  children?: ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  block,
  iconOnly,
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
  return (
    <IonButton {...rest} fill="clear" className={cls}>
      <span className="pl-btn__inner">{children}</span>
    </IonButton>
  );
};

export default Button;
