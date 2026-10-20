import { IonInput } from '@ionic/react';
import { useEffect, useState } from 'react';
import { Button, Chip, Segmented, Sheet } from '../../components';
import type { MoneyData, RecordInput } from '../../data/money';
import { dateKey, middayOf } from '../../lib/dates';
import type { MoneyRecordRow, MoneyRecordType } from '../../lib/database.types';
import { centavosToInput, parsePesoInput } from '../../lib/money';

const TYPES = ['Expense', 'Income', 'Transfer'] as const;
type TypeLabel = (typeof TYPES)[number];
const toType = (t: TypeLabel): MoneyRecordType => t.toLowerCase() as MoneyRecordType;
const toLabel = (t: MoneyRecordType): TypeLabel => (t.charAt(0).toUpperCase() + t.slice(1)) as TypeLabel;

export interface RecordSheetProps {
  /** Open state: null closed, 'new' to add, or the record to edit. */
  record: MoneyRecordRow | 'new' | null;
  data: MoneyData;
  onDismiss: () => void;
  onSave: (input: RecordInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

/** Add or edit an expense, income or transfer. */
const RecordSheet: React.FC<RecordSheetProps> = ({ record, data, onDismiss, onSave, onDelete }) => {
  const [type, setType] = useState<TypeLabel>('Expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [day, setDay] = useState(dateKey(new Date()));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!record) return;
    const r = record === 'new' ? null : record;
    const first = data.accounts[0]?.id ?? '';
    setType(r ? toLabel(r.type) : 'Expense');
    setAmount(r ? centavosToInput(r.amount_centavos) : '');
    setAccountId(r?.account_id ?? first);
    setToAccountId(r?.to_account_id ?? data.accounts.find((a) => a.id !== (r?.account_id ?? first))?.id ?? '');
    setCategoryId(r?.category_id ?? '');
    setDay(r ? dateKey(new Date(r.occurred_at)) : dateKey(new Date()));
    setNote(r?.note ?? '');
    setError(null);
    setConfirmDelete(false);
  }, [record, data.accounts]);

  if (!record) return null;
  const editing = record !== 'new' ? record : null;
  const t = toType(type);
  const categories = data.categories.filter((c) => c.kind === (t === 'income' ? 'income' : 'expense'));

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
      const centavos = parsePesoInput(amount);
      if (!centavos) throw new Error('Enter an amount above zero, like 250 or 1,250.50.');
      if (!accountId) throw new Error('Choose an account.');
      if (t === 'transfer' && (!toAccountId || toAccountId === accountId))
        throw new Error('Choose a different account to transfer to.');
      if (t !== 'transfer' && !categories.some((c) => c.id === categoryId)) throw new Error('Choose a category.');
      // Today keeps the current time so it sorts above earlier records; other days use midday.
      const occurredAt = editing
        ? dateKey(new Date(editing.occurred_at)) === day
          ? editing.occurred_at
          : middayOf(day).toISOString()
        : day === dateKey(new Date())
          ? new Date().toISOString()
          : middayOf(day).toISOString();
      await onSave(
        { type: t, amountCentavos: centavos, accountId, toAccountId: toAccountId || null, categoryId: categoryId || null, note, occurredAt },
        editing?.id,
      );
    });

  const otherAccounts = data.accounts.filter((a) => a.id !== accountId);

  /** Picking the source moves the destination off it, so a transfer always has two accounts. */
  const chooseFrom = (id: string) => {
    setAccountId(id);
    if (!toAccountId || toAccountId === id) setToAccountId(data.accounts.find((a) => a.id !== id)?.id ?? '');
  };

  return (
    <Sheet isOpen onDismiss={onDismiss} labelledBy="record-title">
      <h2 id="record-title" className="t-title-md">
        {editing ? 'Edit record' : 'Add record'}
      </h2>

      <Segmented label="Record type" options={TYPES} value={type} onChange={setType} />

      <label className="money-amount-field">
        <span aria-hidden="true">₱</span>
        <input
          type="text"
          inputMode="decimal"
          aria-label="Amount in pesos"
          placeholder="0.00"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>

      <div className="field">
        <span className="field__label">{t === 'transfer' ? 'From' : 'Account'}</span>
        <div className="pl-chip-wrap" role="group" aria-label={t === 'transfer' ? 'From account' : 'Account'}>
          {data.accounts.map((a) => (
            <Chip key={a.id} label={a.name} selected={accountId === a.id} onSelect={() => chooseFrom(a.id)} />
          ))}
        </div>
      </div>

      {t === 'transfer' ? (
        <div className="field">
          <span className="field__label">To</span>
          {otherAccounts.length === 0 ? (
            <p className="t-cap">Add a second account to transfer between them.</p>
          ) : (
            <div className="pl-chip-wrap" role="group" aria-label="To account">
              {otherAccounts.map((a) => (
                <Chip key={a.id} label={a.name} selected={toAccountId === a.id} onSelect={() => setToAccountId(a.id)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="field">
          <span className="field__label">Category</span>
          <div className="pl-chip-wrap" role="group" aria-label="Category">
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} selected={categoryId === c.id} onSelect={() => setCategoryId(c.id)} />
            ))}
          </div>
        </div>
      )}

      <label className="field">
        <span className="field__label">Date</span>
        <input className="money-date" type="date" aria-label="Date" value={day} onChange={(e) => setDay(e.target.value || dateKey(new Date()))} />
      </label>

      <label className="field">
        <span className="field__label">Note (optional)</span>
        <span className="field__control">
          <IonInput aria-label="Note" maxlength={200} value={note} onIonInput={(e) => setNote(String(e.detail.value ?? ''))} />
        </span>
      </label>

      {error && (
        <p className="t-cap" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      {confirmDelete && editing ? (
        <div className="section" role="alert">
          <p className="t-secondary">Delete this record? Your account balances update. This cannot be undone.</p>
          <Button variant="danger" block disabled={busy} onClick={() => run(() => onDelete(editing.id))}>
            Delete record
          </Button>
          <Button variant="ghost" block disabled={busy} onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
        </div>
      ) : (
        <div className="section">
          <Button variant="primary" size="lg" block disabled={busy} onClick={save}>
            {editing ? 'Save changes' : `Add ${type.toLowerCase()}`}
          </Button>
          {editing && (
            <Button variant="stop" block disabled={busy} onClick={() => setConfirmDelete(true)}>
              Delete record
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

export default RecordSheet;
