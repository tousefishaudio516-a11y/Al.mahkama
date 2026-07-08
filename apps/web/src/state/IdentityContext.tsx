import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { LocalIdentity } from '../types';

const STORAGE_KEY = 'ai-court:identity';

interface IdentityContextValue {
  identity: LocalIdentity | null;
  setIdentity: (identity: LocalIdentity | null) => void;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentityState] = useState<LocalIdentity | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as LocalIdentity) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (identity) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [identity]);

  return (
    <IdentityContext.Provider value={{ identity, setIdentity: setIdentityState }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error('useIdentity يجب أن يُستخدم داخل IdentityProvider');
  return ctx;
}
