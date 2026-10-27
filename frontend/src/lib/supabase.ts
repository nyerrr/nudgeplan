import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * Supabase client. Created only when both env vars are present, so the app
 * still boots (and falls back to the demo adapter) when they are not.
 *
 * Expo inlines EXPO_PUBLIC_* values at build time, so they must be referenced
 * as full literals here - destructuring process.env would not work.
 */
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

export const SUPABASE_CONFIGURED = url.length > 0 && anonKey.length > 0;

export const supabase: SupabaseClient | null = SUPABASE_CONFIGURED
  ? createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        // The browser handles the OAuth redirect by itself; native uses
        // expo-web-browser and parses the returned URL in ./auth. We handle
        // the web callback explicitly there so failures are visible instead
        // of silently dropping the user back on the login screen.
        detectSessionInUrl: false,
        flowType: Platform.OS === 'web' ? 'pkce' : 'implicit',
      },
    })
  : null;
