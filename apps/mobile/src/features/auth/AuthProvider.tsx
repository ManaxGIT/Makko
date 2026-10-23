import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { clearAddressLists } from '@/features/addresses/listCache';
import { clearOrderLists } from '@/features/orders/listCache';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  isLoading: boolean;
  session: Session | null;
};

const AuthContext = createContext<AuthContextValue>({ isLoading: true, session: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let accountId: string | undefined;
    supabase.auth.getSession().then(({ data }) => {
      accountId = data.session?.user.id;
      setSession(data.session);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (accountId !== nextSession?.user.id) { clearOrderLists(); clearAddressLists(); }
      accountId = nextSession?.user.id;
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ isLoading, session }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
