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
  completeWebAuthRedirect,
  createGuestUser,
  loadAuthSession,
  onAuthStateChange,
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
  authError: string | null;
  clearAuthError: () => void;
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
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Never let a stalled session lookup hold the app on a blank screen.
    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 5000);
    });

    (async () => {
      try {
        const redirectError = await completeWebAuthRedirect();
        if (redirectError) {
          console.error('[auth] sign-in redirect failed:', redirectError);
          if (active) setAuthError(redirectError);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Sign-in failed.';
        console.error('[auth] sign-in redirect threw:', error);
        if (active) setAuthError(message);
      }

      const session = await Promise.race([loadAuthSession(), timeout]);
      if (active && session) setUser(session.user);
    })()
      .catch(() => {
        // A failed lookup just means "not signed in".
      })
      .finally(() => {
        if (active) setHydrated(true);
      });

    return () => {
      active = false;
    };
  }, []);

  // Keep in sync with the provider: this is what turns the OAuth redirect
  // (or an emailed link) into a signed-in user, and what drops the session
  // when it is revoked elsewhere.
  useEffect(
    () =>
      onAuthStateChange((next) => {
        if (next) {
          setJustSignedOut(false);
          setUser((current) =>
            current && current.id === next.id && current.name === next.name
              ? current
              : next,
          );
          return;
        }
        // A guest session is local only; the provider has nothing to say
        // about it, so do not sign guests out on an empty event.
        setUser((current) =>
          current && current.provider !== 'guest' ? null : current,
        );
      }),
    [],
  );

  const persistUser = useCallback(async (next: AuthUser) => {
    setJustSignedOut(false);
    setUser(next);
    await saveAuthSession(next);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    // On web this navigates away; on native it resolves once the sheet closes.
    const next = await signInWithGoogleFromProvider();
    if (next) await persistUser(next);
  }, [persistUser]);

  const sendEmailLink = useCallback(async (email: string) => {
    await requestEmailLinkFromProvider(email);
  }, []);

  const completeEmailSignIn = useCallback(
    async (email: string) => {
      const next = await signInWithEmailFromProvider(email);
      if (next) await persistUser(next);
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

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      hydrated,
      demoMode: AUTH_DEMO_MODE,
      justSignedOut,
      authError,
      clearAuthError,
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
      authError,
      clearAuthError,
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
