import { Button, Sheet } from '../../components';

export interface SignOutSheetProps {
  isOpen: boolean;
  busy: boolean;
  onDismiss: () => void;
  onConfirm: () => Promise<void>;
}

/** Warns that changes not yet synced are lost when signing out. */
const SignOutSheet: React.FC<SignOutSheetProps> = ({ isOpen, busy, onDismiss, onConfirm }) => (
  <Sheet isOpen={isOpen} onDismiss={onDismiss} labelledBy="signout-title">
    <div>
      <h2 id="signout-title" className="t-title-md">
        Sign out with unsynced changes?
      </h2>
      <p className="t-secondary" style={{ marginTop: 'var(--space-2)' }}>
        Some changes have not synced yet. If you sign out now they will be lost. Connect to the internet first to keep them.
      </p>
    </div>
    <div className="section">
      <Button variant="danger" block disabled={busy} aria-label="Sign out anyway" onClick={() => void onConfirm()}>
        Sign out anyway
      </Button>
      <Button variant="ghost" block disabled={busy} aria-label="Cancel" onClick={onDismiss}>
        Cancel
      </Button>
    </div>
  </Sheet>
);

export default SignOutSheet;
