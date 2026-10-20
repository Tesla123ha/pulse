import { useIonViewDidLeave, useIonViewWillEnter } from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DATA_CHANGED } from '../offline/outbox';
import { useSync } from '../offline/SyncProvider';

export interface Loaded<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  /** Replace loaded data locally after a write, without a round trip. */
  setData: (update: (prev: T) => T) => void;
}

/**
 * Runs `load` on mount and every time the Ionic page comes back into view,
 * so tabs show fresh data after edits elsewhere. Must be used inside an IonPage.
 */
export function useLoader<T>(load: () => Promise<T>): Loaded<T> {
  const { hasPulled, online } = useSync();
  // 'ok': local data can be read; 'wait': first pull is still coming; 'offline': it never will.
  const gate = hasPulled ? 'ok' : online ? 'wait' : 'offline';
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;
  const gateRef = useRef(gate);
  gateRef.current = gate;
  // Refs, not state: Ionic keeps the first view-enter callback, so it must not read stale state.
  const loadingRef = useRef(false);
  const enteredOnce = useRef(false);
  const activeRef = useRef(true);
  const dirtyRef = useRef(false);

  const run = useCallback(async (silent: boolean) => {
    if (gateRef.current === 'wait') {
      setLoading(true);
      return;
    }
    if (gateRef.current === 'offline') {
      setError(CONNECT_ONCE);
      setLoading(false);
      return;
    }
    loadingRef.current = true;
    if (!silent) setLoading(true);
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      loadingRef.current = false;
      setLoading(false);
      // Local data changed while loading: read again so the screen is not stale.
      if (dirtyRef.current && activeRef.current) {
        dirtyRef.current = false;
        void run(true);
      }
    }
  }, []);

  const reload = useCallback(() => run(false), [run]);

  useEffect(() => {
    void run(false);
  }, [run, gate]);

  // Local writes and pulls announce themselves; refresh quietly while this page is showing.
  useEffect(() => {
    const onChanged = () => {
      if (!activeRef.current) return;
      if (loadingRef.current) dirtyRef.current = true;
      else void run(true);
    };
    window.addEventListener(DATA_CHANGED, onChanged);
    return () => window.removeEventListener(DATA_CHANGED, onChanged);
  }, [run]);

  useIonViewWillEnter(() => {
    activeRef.current = true;
    // The first enter is covered by the mount effect; later enters refresh.
    if (!enteredOnce.current) {
      enteredOnce.current = true;
      return;
    }
    if (!loadingRef.current) void run(false);
  });

  useIonViewDidLeave(() => {
    activeRef.current = false;
  });

  const patch = useCallback((update: (prev: T) => T) => setData((prev) => (prev === null ? prev : update(prev))), []);

  return { data, error, loading, reload, setData: patch };
}

export const CONNECT_ONCE = 'Connect once to load your data.';

/** Plain-language message for a failed load. */
export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/local database is not open/i.test(msg)) return 'Pulse is still opening your data. Try again in a moment.';
  if (/failed to fetch|network|load failed/i.test(msg)) return 'Pulse could not reach the server. Check your connection and try again.';
  return msg;
}

type Res = { data: unknown; error: { message: string } | null };

/** Unwraps a Supabase response, throwing its error or a missing row. */
export function must<R extends Res>(res: R): NonNullable<R['data']> {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null || res.data === undefined) throw new Error('Expected data but the query returned none.');
  return res.data as NonNullable<R['data']>;
}

/** Unwraps a `maybeSingle()` or write response, where no data is valid. */
export function maybe<R extends Res>(res: R): R['data'] | null {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? null;
}
