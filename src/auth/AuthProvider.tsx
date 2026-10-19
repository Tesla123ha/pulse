import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  /** True until the stored session has been read. */
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, loading: false }));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
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
