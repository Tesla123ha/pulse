import { IonInput } from '@ionic/react';
import { useEffect, useState } from 'react';
import { Button, Chip, Sheet } from '../../components';
import type { AccountInput, MoneyAccount } from '../../data/money';
import type { AccountKind } from '../../lib/database.types';
import { ACCOUNT_KINDS, centavosToInput, parseSignedPesoInput } from '../../lib/money';

export interface AccountSheetProps {
  /** Open state: null closed, 'new' to add, or the account to edit. */
  account: MoneyAccount | 'new' | null;
  onDismiss: () => void;
  onSave: (input: AccountInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

/** Add or edit an account: name, type and starting balance. */
const AccountSheet: React.FC<AccountSheetProps> = ({ account, onDismiss, onSave, onDelete }) => {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('cash');
  const [opening, setOpening] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!account) return;
    const a = account === 'new' ? null : account;
    setName(a?.name ?? '');
    setKind(a?.kind ?? 'cash');
    setOpening(a ? centavosToInput(Number(a.opening_balance_centavos)) : '0');
    setError(null);
    setConfirmDelete(false);
  }, [account]);

  if (!account) return null;
  const editing = account !== 'new' ? account : null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      const openingCentavos = parseSignedPesoInput(opening || '0');
      if (!name.trim()) throw new Error('Give the account a name.');
      if (openingCentavos === null) throw new Error('Enter the starting balance as a number, like 1500 or 1,500.50.');
      await onSave({ name, kind, openingBalanceCentavos: openingCentavos }, editing?.id);
    });

  return (
    <Sheet isOpen onDismiss={onDismiss} labelledBy="account-title">
      <h2 id="account-title" className="t-title-md">
        {editing ? 'Edit account' : 'Add account'}
      </h2>

      <label className="field">
        <span className="field__label">Name</span>
        <span className="field__control">
          <IonInput
            aria-label="Account name"
            placeholder="GCash, BPI savings, Wallet"
            maxlength={40}
            value={name}
            onIonInput={(e) => setName(String(e.detail.value ?? ''))}
          />
        </span>
      </label>

      <div className="field">
        <span className="field__label">Type</span>
        <div className="pl-chip-wrap" role="group" aria-label="Account type">
          {ACCOUNT_KINDS.map((k) => (
            <Chip key={k.kind} label={k.label} selected={kind === k.kind} onSelect={() => setKind(k.kind)} />
          ))}
        </div>
      </div>

      <label className="field">
        <span className="field__label">Starting balance (₱)</span>
        <span className="field__control">
          <IonInput
            aria-label="Starting balance in pesos"
            inputmode="decimal"
            value={opening}
            onIonInput={(e) => setOpening(String(e.detail.value ?? ''))}
          />
        </span>
        <span className="t-cap">What the account held before your first record here. Use a minus for card debt.</span>
      </label>

      {error && (
        <p className="t-cap" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {confirmDelete && editing ? (
        <div className="section" role="alert">
          <p className="t-secondary">
            Delete {editing.name}? This also deletes every record in it, including transfers to and from it. This cannot be
            undone.
          </p>
          <Button variant="danger" block disabled={busy} onClick={() => run(() => onDelete(editing.id))}>
            Delete account and records
          </Button>
          <Button variant="ghost" block disabled={busy} onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
        </div>
      ) : (
        <div className="section">
          <Button variant="primary" size="lg" block disabled={busy} onClick={save}>
            {editing ? 'Save changes' : 'Add account'}
          </Button>
          {editing && (
            <Button variant="stop" block disabled={busy} onClick={() => setConfirmDelete(true)}>
              Delete account
            </Button>
          )}
          <Button variant="ghost" block disabled={busy} onClick={onDismiss}>
            Cancel
          </Button>
        </div>
      )}
    </Sheet>
  );
};

export default AccountSheet;
