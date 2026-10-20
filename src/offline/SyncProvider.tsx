import { liveQuery } from 'dexie';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { closeUserDb, openUserDb, type PulseDB } from './db';
import { isOnline, onNetworkChange } from './network';
import { discardFailed, onSyncStatus, startSync, syncNow } from './sync';

export interface SyncState {
  /** Null until the local database is open. */
  db: PulseDB | null;
  online: boolean;
  syncing: boolean;
  /** Local writes not yet on the server. */
  pending: number;
  /** Writes the server rejected; they stay until discarded. */
  failed: number;
  lastSyncedAt: string | null;
  /** True once this device has pulled the server's data at least once. */
  hasPulled: boolean;
  /** Local database open and either pulled before or offline (so waiting would be pointless). */
  ready: boolean;
  syncNow: () => Promise<void>;
  discardFailed: (seq: number) => Promise<void>;
}

const SyncContext = createContext<SyncState | null>(null);

/** Opens the user's local database and runs the sync engine. Mount only while signed in. */
export const SyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [db, setDb] = useState<PulseDB | null>(null);
  const [online, setOnline] = useState(isOnline());
  const [status, setStatus] = useState({ syncing: false, lastSyncedAt: null as string | null });
  const [pulledBefore, setPulledBefore] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, failed: 0 });

  useEffect(() => onNetworkChange(setOnline), []);
  useEffect(() => onSyncStatus(setStatus), []);

  useEffect(() => {
    if (!userId) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void openUserDb(userId).then(async (opened) => {
      if (cancelled) return;
      // Read before exposing the db so loaders never see a false "never pulled".
      const meta = await opened.meta.get('lastPulledAt');
      if (cancelled) return;
      setPulledBefore(typeof meta?.value === 'string');
      setDb(opened);
      stop = startSync(opened, userId);
    });
    return () => {
      cancelled = true;
      stop?.();
      setDb(null);
      setPulledBefore(false);
      closeUserDb();
    };
  }, [userId]);

  useEffect(() => {
    if (!db) return;
    const sub = liveQuery(async () => ({
      pending: await db.outbox.where('status').equals('pending').count(),
      failed: await db.outbox.where('status').equals('failed').count(),
    })).subscribe(setCounts);
    return () => sub.unsubscribe();
  }, [db]);

  const value = useMemo<SyncState>(() => {
    const hasPulled = pulledBefore || status.lastSyncedAt !== null;
    return { db, online, ...status, ...counts, hasPulled, ready: db !== null && (hasPulled || !online), syncNow, discardFailed };
  }, [db, online, status, counts, pulledBefore]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useSync(): SyncState {
  const v = useContext(SyncContext);
  if (!v) throw new Error('useSync called outside SyncProvider.');
  return v;
}
