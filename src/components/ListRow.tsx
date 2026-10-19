import { IonItem } from '@ionic/react';
import type { ReactNode } from 'react';
import Icon, { type IconName } from './Icon';

export interface ListRowProps {
  title: string;
  caption?: ReactNode;
  /** Neutral icon well at the start. Same well and `text` icon for every row. */
  icon?: IconName;
  /** Trailing slot: a value, a button. Defaults to a chevron when the row navigates. */
  end?: ReactNode;
  routerLink?: string;
  onClick?: () => void;
  /** Dashed outline for an empty slot that invites the next step. */
  dashed?: boolean;
}

/** Tappable row for a workout, meal or setting. Minimum height 72px. */
const ListRow: React.FC<ListRowProps> = ({ title, caption, icon, end, routerLink, onClick, dashed }) => {
  const navigates = Boolean(routerLink || onClick);
  return (
    <IonItem
      className={`pl-listrow${dashed ? ' pl-listrow--dashed' : ''}`}
      lines="none"
      detail={false}
      routerLink={routerLink}
      onClick={onClick}
      button={navigates}
    >
      <div className="pl-listrow__body">
        {icon && (
          <span className="pl-well">
            <Icon name={icon} />
          </span>
        )}
        <div className="pl-listrow__main">
          <div className="pl-listrow__title">{title}</div>
          {caption && <div className="t-cap">{caption}</div>}
        </div>
        {end !== undefined ? (
          end
        ) : navigates ? (
          <span className="pl-listrow__end">
            <Icon name="chevronRight" />
          </span>
        ) : null}
      </div>
    </IonItem>
  );
};

export default ListRow;
