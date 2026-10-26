import AsyncStorage from '@react-native-async-storage/async-storage';

import { nameFromEmail, normaliseEmail } from './authIdentity';

export type AuthProvider = 'google' | 'email' | 'guest';

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  provider: AuthProvider;
}

interface AuthSession {
  v: 1;
  user: AuthUser;
  createdAt: string;
}

const SESSION_KEY = 'nudgeplan-auth-1';

/**
 * The login UI talks only to the adapter functions in this file. When you are
 * ready to connect Supabase, replace the demo implementations below with
 * signInWithOAuth / signInWithOtp / getSession and keep the same return shape.
 * No screen changes should be needed.
 */
export const AUTH_DEMO_MODE = true;

const DEMO_GOOGLE_USER: AuthUser = {
  id: 'google-demo',
  name: 'Alex Morgan',
  email: 'alex.morgan@gmail.com',
  provider: 'google',
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    typeof user.name === 'string' &&
    (user.email === null || typeof user.email === 'string') &&
    (user.provider === 'google' ||
      user.provider === 'email' ||
      user.provider === 'guest')
  );
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (parsed?.v !== 1 || !isAuthUser(parsed.user)) return null;
    return parsed as AuthSession;
  } catch {
    // A broken session should never block the login screen.
    return null;
  }
}

export async function saveAuthSession(user: AuthUser): Promise<boolean> {
  try {
    const session: AuthSession = {
      v: 1,
      user,
      createdAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    // The session still works in memory for this launch.
    return false;
  }
}

export async function clearAuthSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing else to do; the caller drops the in-memory session.
  }
}

export async function signInWithGoogle(): Promise<AuthUser> {
  // TODO(auth): replace with Supabase signInWithOAuth({ provider: 'google' }).
  await wait(650);
  return { ...DEMO_GOOGLE_USER };
}

export async function requestEmailLink(email: string): Promise<void> {
  // TODO(auth): replace with Supabase signInWithOtp({ email }).
  await wait(550);
  if (!normaliseEmail(email)) throw new Error('Email is required.');
}

export async function signInWithEmail(email: string): Promise<AuthUser> {
  // TODO(auth): replace with the Supabase session returned after the magic link.
  await wait(450);
  const clean = normaliseEmail(email);
  return {
    id: `email-${clean}`,
    name: nameFromEmail(clean),
    email: clean,
    provider: 'email',
  };
}

export function createGuestUser(): AuthUser {
  return {
    id: 'guest-local',
    name: '',
    email: null,
    provider: 'guest',
  };
}
