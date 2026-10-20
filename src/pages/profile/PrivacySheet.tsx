import { useState } from 'react';
import { Button, Sheet } from '../../components';

export interface PrivacySheetProps {
  isOpen: boolean;
  onDismiss: () => void;
  onExport: () => Promise<void>;
}

/** What Pulse stores, and a download of it. */
const PrivacySheet: React.FC<PrivacySheetProps> = ({ isOpen, onDismiss, onExport }) => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  return (
    <Sheet isOpen={isOpen} onDismiss={onDismiss} labelledBy="privacy-title">
      <h2 id="privacy-title" className="t-title-md">
        Privacy and data
      </h2>
      <p className="t-secondary">
        Pulse stores your profile, workouts, sets, activities and records in your account. Only you can read them.
      </p>
      {note && (
        <p className="t-cap" role="status">
          {note}
        </p>
      )}
      <div className="section">
        <Button
          disabled={busy}
          block
          onClick={async () => {
            setBusy(true);
            setNote(null);
            try {
              await onExport();
              setNote('Your data file is downloading.');
            } catch (e) {
              setNote(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Download my data
        </Button>
        <Button variant="ghost" block onClick={onDismiss}>
          Close
        </Button>
      </div>
    </Sheet>
  );
};

export default PrivacySheet;
