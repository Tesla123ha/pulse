import { useIonViewWillEnter } from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;
  const mounted = useRef(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
  }, [reload]);

  useIonViewWillEnter(() => {
    // The first enter is covered by the mount effect.
    if (mounted.current && !loading) void reload();
  });

  const patch = useCallback((update: (prev: T) => T) => setData((prev) => (prev === null ? prev : update(prev))), []);

  return { data, error, loading, reload, setData: patch };
}

/** Plain-language message for a failed load. */
export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
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
