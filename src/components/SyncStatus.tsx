import { liveQuery } from 'dexie';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useState } from 'react';
import { useSync } from '../offline/SyncProvider';
import type { OutboxOp, SyncTable } from '../offline/outbox';
import Button from './Button';
import Icon from './Icon';
import Sheet from './Sheet';

const TABLE_NAMES: Record<SyncTable, string> = {
  profiles: 'Profile',
  workout_sessions: 'Workout session',
  set_logs: 'Workout set',
  activity_logs: 'Activity',
  plan_workouts: 'Plan workout',
  personal_records: 'Personal record',
  user_achievements: 'Achievement',
  exercise_load_prefs: 'Weight unit',
  money_accounts: 'Money account',
  money_records: 'Money record',
};

const KIND_VERBS: Record<OutboxOp['kind'], string> = {
  upsert: 'Saved',
  update: 'Edited',
  delete: 'Deleted',
  updateWhere: 'Edited',
};

function describe(op: OutboxOp): string {
  return `${KIND_VERBS[op.kind]} ${(TABLE_NAMES[op.table] ?? 'Item').toLowerCase()}`;
}

function changes(n: number): string {
  return `${n} ${n === 1 ? 'change' : 'changes'}`;
}

/**
 * Small pill showing offline and sync state, fixed above the tab bar. Hidden when online, synced
 * and nothing is waiting. Failed writes open a sheet where each can be discarded or retried.
 */
const SyncStatus: React.FC = () => {
  const { db, online, syncing, pending, failed, syncNow, discardFailed } = useSync();
  const [open, setOpen] = useState(false);
  const [ops, setOps] = useState<OutboxOp[]>([]);

  useEffect(() => {
    if (!db) return;
    const sub = liveQuery(() => db.outbox.where('status').equals('failed').toArray()).subscribe(setOps);
    return () => sub.unsubscribe();
  }, [db]);

  useEffect(() => {
    if (failed === 0) setOpen(false);
  }, [failed]);

  let text: string | null = null;
  let tone: 'quiet' | 'busy' | 'failed' = 'quiet';
  if (failed > 0) {
    text = `${changes(failed)} could not sync`;
    tone = 'failed';
  } else if (!online) {
    text = pending > 0 ? `Offline, ${changes(pending)} waiting` : 'Offline';
  } else if (syncing) {
    text = 'Syncing';
    tone = 'busy';
  } else if (pending > 0) {
    text = `${changes(pending)} waiting`;
  }

  const inner = (
    <>
      {tone === 'failed' ? (
        <Icon name="bell" size={18} />
      ) : (
        <span className={`pl-sync__dot pl-sync__dot--${tone}`} aria-hidden="true" />
      )}
      <span>{text}</span>
    </>
  );

  // Ionic gives each routed page its own stacking context above the outlet, so the pill is portalled
  // into ion-app (like Ionic's own overlays) to sit above the page and its tab bar.
  const host = document.querySelector('ion-app') ?? document.body;

  return (
    <>
      {createPortal(
        <div className="pl-sync" role="status" aria-live="polite">
          <AnimatePresence>
            {text && (
              <m.div
                key="pill"
                className="pl-sync__slot"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {tone === 'failed' ? (
                  <button type="button" className="pl-sync__pill pl-sync__pill--failed" onClick={() => setOpen(true)}>
                    {inner}
                    <span className="pl-sync__hint">Review</span>
                  </button>
                ) : (
                  <span className="pl-sync__pill">{inner}</span>
                )}
              </m.div>
            )}
          </AnimatePresence>
        </div>,
        host,
      )}
      <Sheet isOpen={open} onDismiss={() => setOpen(false)} labelledBy="sync-failed-title">
        <div>
          <h2 id="sync-failed-title" className="t-title-md">
            Changes that could not sync
          </h2>
          <p className="t-cap">These stay on this device until you try again or discard them.</p>
        </div>
        <ul className="pl-sync__list">
          {ops.map((op) => (
            <li key={op.seq} className="pl-sync__item">
              <div className="pl-sync__item-text">
                <span className="pl-sync__item-title">{describe(op)}</span>
                {op.lastError && <span className="pl-sync__item-error">{op.lastError}</span>}
              </div>
              <Button
                variant="ghost"
                aria-label={`Discard ${describe(op).toLowerCase()}`}
                onClick={() => op.seq !== undefined && void discardFailed(op.seq)}
              >
                Discard
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" block disabled={!online} onClick={() => void syncNow()}>
          Try again
        </Button>
      </Sheet>
    </>
  );
};

export default SyncStatus;
