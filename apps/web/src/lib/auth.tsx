/** Auth context: demo (one-click) and live (signup/login) coexist. */
import {
  createContext, useContext, useEffect, useState, useCallback, type ReactNode,
} from 'react';
import type { AuthUser, Role } from '@sanctum/shared';
import { api } from './api.js';
import {
  setToken, clearToken, getToken, setSessionMode, clearSessionMode, getSessionMode, isLive,
} from './config.js';
import { resetDemo, rehydrate } from './store.js';
import { DEMO_USERS } from './mockData.js';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  demoLogin: (role: 'operator' | 'renter' | 'admin') => void;
  login: (email: string, password: string, turnstileToken?: string | null) => Promise<AuthUser>;
  signup: (input: SignupInput) => Promise<AuthUser>;
  logout: () => void;
}

export interface SignupInput {
  email: string;
  password: string;
  full_name?: string;
  role: Role;
  organization_name?: string;
  turnstile_token?: string | null;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore a live session on load (demo never persists).
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const token = getToken();
      if (token && getSessionMode() === 'live') {
        try {
          const { user: u } = await api<{ user: AuthUser }>('/auth/me');
          await rehydrate();
          if (!cancelled) setUser(u);
        } catch {
          clearToken();
          clearSessionMode();
        }
      }
      if (!cancelled) setLoading(false);
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const demoLogin = useCallback((role: 'operator' | 'renter' | 'admin') => {
    clearToken();
    setSessionMode('demo');
    resetDemo();
    const u = DEMO_USERS[role];
    setUser({ id: u.id, email: u.email, role: u.role, full_name: u.full_name });
  }, []);

  const login = useCallback(async (email: string, password: string, turnstileToken?: string | null) => {
    const { token, user: u } = await api<{ token: string; user: AuthUser }>('/auth/login', {
      body: { email, password, turnstile_token: turnstileToken }, auth: false,
    });
    setToken(token);
    setSessionMode('live');
    await rehydrate();
    setUser(u);
    return u;
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const { token, user: u } = await api<{ token: string; user: AuthUser }>('/auth/signup', {
      body: input, auth: false,
    });
    setToken(token);
    setSessionMode('live');
    await rehydrate();
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    clearSessionMode();
    clearToken();
    resetDemo();
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, demoLogin, login, signup, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { isLive };
