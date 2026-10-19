import { IonModal } from '@ionic/react';
import type { ReactNode } from 'react';

export interface SheetProps {
  isOpen: boolean;
  onDismiss: () => void;
  /** id of the sheet's heading, for aria-labelledby. */
  labelledBy: string;
  children: ReactNode;
}

/** Bottom sheet on surface-raised with radius-xl corners and a drag handle. */
const Sheet: React.FC<SheetProps> = ({ isOpen, onDismiss, labelledBy, children }) => (
  <IonModal
    className="pl-sheet"
    isOpen={isOpen}
    onDidDismiss={onDismiss}
    initialBreakpoint={1}
    breakpoints={[0, 1]}
    aria-labelledby={labelledBy}
  >
    <div className="pl-sheet__body">{children}</div>
  </IonModal>
);

export default Sheet;
