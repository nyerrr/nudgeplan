import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AUTH_DEMO_MODE,
  clearAuthSession,
  createGuestUser,
  loadAuthSession,
  requestEmailLink as requestEmailLinkFromProvider,
  saveAuthSession,
  signInWithEmail as signInWithEmailFromProvider,
  signInWithGoogle as signInWithGoogleFromProvider,
  type AuthUser,
} from './lib/auth';

interface AuthContextValue {
  user: AuthUser | null;
  hydrated: boolean;
  demoMode: boolean;
  justSignedOut: boolean;
  signInWithGoogle: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  completeEmailSignIn: (email: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  clearSignedOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [justSignedOut, setJustSignedOut] = useState(false);

  useEffect(() => {
    let active = true;
    loadAuthSession()
      .then((session) => {
        if (active && session) setUser(session.user);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const persistUser = useCallback(async (next: AuthUser) => {
    setJustSignedOut(false);
    setUser(next);
    await saveAuthSession(next);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const next = await signInWithGoogleFromProvider();
    await persistUser(next);
  }, [persistUser]);

  const sendEmailLink = useCallback(async (email: string) => {
    await requestEmailLinkFromProvider(email);
  }, []);

  const completeEmailSignIn = useCallback(
    async (email: string) => {
      const next = await signInWithEmailFromProvider(email);
      await persistUser(next);
    },
    [persistUser],
  );

  const continueAsGuest = useCallback(async () => {
    await persistUser(createGuestUser());
  }, [persistUser]);

  const signOut = useCallback(async () => {
    const wasSignedIn =
      user?.provider === 'google' || user?.provider === 'email';
    setUser(null);
    setJustSignedOut(wasSignedIn);
    await clearAuthSession();
  }, [user]);

  const clearSignedOut = useCallback(() => {
    setJustSignedOut(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      hydrated,
      demoMode: AUTH_DEMO_MODE,
      justSignedOut,
      signInWithGoogle,
      sendEmailLink,
      completeEmailSignIn,
      continueAsGuest,
      signOut,
      clearSignedOut,
    }),
    [
      user,
      hydrated,
      justSignedOut,
      signInWithGoogle,
      sendEmailLink,
      completeEmailSignIn,
      continueAsGuest,
      signOut,
      clearSignedOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
