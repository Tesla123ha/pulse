import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { deleteUserDb } from '../offline/db';
import { isOnline } from '../offline/network';

interface AuthState {
  session: Session | null;
  /** True until the stored session has been read. */
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  /** The only way to leave the signed-in state: clears the session and this user's local data. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  signOut: async () => undefined,
});

/** Supabase persists the session under `sb-<project-ref>-auth-token`. */
function storageKey(): string | null {
  try {
    const host = new URL(import.meta.env.VITE_SUPABASE_URL as string).hostname;
    const ref = host.split('.')[0];
    return ref ? `sb-${ref}-auth-token` : null;
  } catch {
    return null;
  }
}

/** The session saved on this device, even if its access token has expired. Null if none or unreadable. */
function readStoredSession(): Session | null {
  try {
    const key = storageKey();
    if (!key) return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session> | null;
    if (!parsed || typeof parsed !== 'object' || !parsed.user?.id || !parsed.refresh_token) return null;
    return parsed as Session;
  } catch {
    return null;
  }
}

function isRetryable(error: { name?: string } | null): boolean {
  return error?.name === 'AuthRetryableFetchError';
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });
  // Set while the user is signing out on purpose; any other SIGNED_OUT may be a failed offline refresh.
  const explicitSignOut = useRef(false);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error && (!isOnline() || isRetryable(error))) {
          // Offline with an expired token: trust the session saved on this device.
          setState({ session: readStoredSession(), loading: false });
        } else {
          setState({ session: data.session, loading: false });
        }
      })
      .catch(() => {
        if (active) setState({ session: readStoredSession(), loading: false });
      });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && !explicitSignOut.current && !isOnline()) {
        // A token refresh failed because there is no network. Keep the session.
        return;
      }
      if (!session && event !== 'SIGNED_OUT') {
        // INITIAL_SESSION or a failed refresh without a session: fall back to storage.
        const stored = readStoredSession();
        if (stored && !explicitSignOut.current) {
          setState((s) => (s.session ? { ...s, loading: false } : { session: stored, loading: false }));
          return;
        }
      }
      setState({ session, loading: false });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Pause token refresh while the app is in the background on Android.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    });
    return () => {
      void handle.then((h) => h.remove()).catch(() => undefined);
    };
  }, []);

  const userId = state.session?.user.id ?? null;
  const signOut = useCallback(async () => {
    explicitSignOut.current = true;
    try {
      // Revoke on the server when reachable; otherwise just clear this device.
      const { error } = await supabase.auth.signOut();
      if (error) await supabase.auth.signOut({ scope: 'local' });
      setState({ session: null, loading: false });
      if (userId) await deleteUserDb(userId);
    } finally {
      explicitSignOut.current = false;
    }
  }, [userId]);

  const value = useMemo<AuthContextValue>(() => ({ ...state, signOut }), [state, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

/** The signed-in user's id. Only call inside screens behind the session guard. */
// eslint-disable-next-line react-refresh/only-export-components
export const useUserId = () => {
  const { session } = useAuth();
  if (!session) throw new Error('useUserId called outside the session guard.');
  return session.user.id;
};
