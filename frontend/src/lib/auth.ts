import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { nameFromEmail, normaliseEmail } from './authIdentity';
import { supabase, SUPABASE_CONFIGURED } from './supabase';

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
 * Demo mode is now derived from configuration: as soon as the Supabase env
 * vars are present the screens stop calling the app a preview.
 */
export const AUTH_DEMO_MODE = !SUPABASE_CONFIGURED;

/** Used by the login screen to show the right copy. */
export const AUTH_CONFIGURED = SUPABASE_CONFIGURED;

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

/** Map a Supabase user onto the shape the rest of the app already uses. */
function fromSupabaseUser(user: User): AuthUser {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const rawName =
    (typeof metadata.full_name === 'string' && metadata.full_name) ||
    (typeof metadata.name === 'string' && metadata.name) ||
    nameFromEmail(user.email ?? '');
  const provider: AuthProvider =
    user.app_metadata?.provider === 'google' ? 'google' : 'email';

  return {
    id: user.id,
    name: (rawName || 'Friend').slice(0, 40),
    email: user.email ?? null,
    provider,
  };
}

function sessionFromUser(user: User): AuthSession {
  return { v: 1, user: fromSupabaseUser(user), createdAt: new Date().toISOString() };
}

/**
 * Where the provider sends the user back to.
 * Web: the origin the app is served from (must be listed in Supabase).
 * Native: the app scheme from app.json ("nudgeplan://auth/callback").
 */
function redirectUrl(): string {
  if (Platform.OS === 'web') {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    // A file:// page has the origin "null". Supabase would reject it and fall
    // back to the project Site URL, which sends the browser to the native
    // scheme instead of the app.
    if (!/^https?:\/\//.test(origin)) {
      throw new Error(
        'Google sign-in needs the web app served over http(s). Open http://localhost:8081 rather than the HTML file directly.',
      );
    }
    return origin;
  }
  return Linking.createURL('/auth/callback');
}

/** Native only: turn the OAuth return URL into a Supabase session. */
async function createSessionFromUrl(url: string): Promise<void> {
  if (!supabase) return;

  const parsed = Linking.parse(url);
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed.queryParams ?? {})) {
    if (typeof value === 'string') params[key] = value;
  }
  const fragment = url.includes('#') ? url.split('#')[1] : '';
  const hash = new URLSearchParams(fragment);
  const accessToken = params.access_token ?? hash.get('access_token') ?? '';
  const refreshToken = params.refresh_token ?? hash.get('refresh_token') ?? '';
  const code = params.code ?? hash.get('code') ?? '';

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return;
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  }
}

async function currentSupabaseUser(): Promise<AuthUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ? fromSupabaseUser(data.session.user) : null;
}

async function loadLocalSession(): Promise<AuthSession | null> {
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

function cleanAuthParams(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    const keys = [
      'code',
      'error',
      'error_description',
      'error_code',
      'access_token',
      'refresh_token',
      'expires_in',
      'expires_at',
      'token_type',
      'provider_token',
      'provider_refresh_token',
      'state',
      'type',
    ];
    for (const key of keys) url.searchParams.delete(key);

    const rawHash = url.hash.replace(/^#/, '');
    if (rawHash) {
      const params = new URLSearchParams(rawHash);
      for (const key of keys) params.delete(key);
      const rest = params.toString();
      url.hash = rest ? `#${rest}` : '';
    }
    window.history.replaceState({}, document.title, url.toString());
  } catch {
    // Cosmetic only; a leftover query string is harmless.
  }
}

/**
 * Web only. The provider sends the browser back to the app with either a
 * `code` (PKCE) or an error. Exchange it here and return a human-readable
 * message when it fails, so the login screen can explain the problem instead
 * of quietly staying signed out.
 */
export async function completeWebAuthRedirect(): Promise<string | null> {
  if (!supabase || Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const providerError = search.get('error') ?? hash.get('error');
  if (providerError) {
    const description =
      search.get('error_description') ??
      hash.get('error_description') ??
      providerError;
    cleanAuthParams();
    return description.replace(/\+/g, ' ');
  }

  const code = search.get('code') ?? hash.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    cleanAuthParams();
    return error ? error.message : null;
  }

  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    cleanAuthParams();
    return error ? error.message : null;
  }

  return null;
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return sessionFromUser(data.session.user);
    } catch {
      // Fall through to the local (guest) session.
    }

    // Guests are local by design. A leftover demo account from the preview
    // build is not: it would sign the app in as "Alex Morgan" without ever
    // touching Supabase, skipping the login screen entirely.
    const local = await loadLocalSession();
    if (local && local.user.provider === 'guest') return local;
    if (local) {
      try {
        await AsyncStorage.removeItem(SESSION_KEY);
      } catch {
        // Best effort; the session is ignored either way.
      }
    }
    return null;
  }
  return loadLocalSession();
}

export async function saveAuthSession(user: AuthUser): Promise<boolean> {
  // Supabase persists its own session; only guests need local persistence.
  if (supabase && user.provider !== 'guest') return true;
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
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Signing out of the provider must not block the local sign-out.
    }
  }
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing else to do; the caller drops the in-memory session.
  }
}

/**
 * Returns the signed-in user, or null when the browser is about to navigate
 * to the provider (web) or the user dismissed the sheet (native).
 */
export async function signInWithGoogle(): Promise<AuthUser | null> {
  if (!supabase) {
    // Demo adapter: no network, no provider.
    await wait(650);
    return { ...DEMO_GOOGLE_USER };
  }

  const redirectTo = redirectUrl();

  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
    return null;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Google sign-in could not start.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return null;

  await createSessionFromUrl(result.url);
  return currentSupabaseUser();
}

export async function requestEmailLink(email: string): Promise<void> {
  if (!supabase) {
    // Demo adapter: nothing is sent.
    await wait(550);
    if (!normaliseEmail(email)) throw new Error('Email is required.');
    return;
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: normaliseEmail(email),
    options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true },
  });
  if (error) throw error;
}

/**
 * Only used by the demo "Open demo link" button. In live mode the session is
 * created by the emailed link instead, so this just reports what it finds.
 */
export async function signInWithEmail(email: string): Promise<AuthUser | null> {
  if (!supabase) {
    await wait(450);
    const clean = normaliseEmail(email);
    return {
      id: `email-${clean}`,
      name: nameFromEmail(clean),
      email: clean,
      provider: 'email',
    };
  }

  const user = await currentSupabaseUser();
  if (!user) {
    throw new Error('Open the sign-in link from your email to finish.');
  }
  return user;
}

export function createGuestUser(): AuthUser {
  return {
    id: 'guest-local',
    name: '',
    email: null,
    provider: 'guest',
  };
}

/**
 * Subscribe to provider session changes (OAuth redirect, token refresh,
 * remote sign-out). Returns an unsubscribe function.
 */
export function onAuthStateChange(
  handler: (user: AuthUser | null) => void,
): () => void {
  if (!supabase) return () => {};

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    handler(session?.user ? fromSupabaseUser(session.user) : null);
  });

  return () => data.subscription.unsubscribe();
}
