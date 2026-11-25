'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, primeCsrf } from '@/lib/api';
import type { SessionUser } from '@/types/api';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  permissions: string[];
  responsibilities: string[];
  hasPermission: (...permissions: string[]) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  isCR: boolean;
  isVolunteer: boolean;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: SessionUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    try {
      const profile = await api.get<SessionUser>('/auth/me');
      setUser(profile);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    await primeCsrf();
    const { user: signedIn } = await api.post<{ user: SessionUser }>('/auth/login', { email, password });
    const profile = await api.get<SessionUser>('/auth/me');
    setUser(profile);
    return { ...signedIn, ...profile };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      router.replace('/login');
    }
  }, [router]);

  const permissions = user?.permissions ?? [];
  const responsibilities = useMemo(
    () => (user?.responsibilities ?? []).map((responsibility) => responsibility.type),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      permissions,
      responsibilities,
      hasPermission: (...required) => required.every((permission) => permissions.includes(permission)),
      hasAnyPermission: (...required) => required.some((permission) => permissions.includes(permission)),
      isCR: responsibilities.includes('cr'),
      isVolunteer: responsibilities.includes('volunteer'),
      signIn,
      signOut,
      refresh: loadUser,
      setUser,
    }),
    [user, loading, permissions, responsibilities, signIn, signOut, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};
