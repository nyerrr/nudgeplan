import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppState } from '../types';

const KEY = 'nudgeplan-app-1';

export async function loadState(): Promise<AppState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed?.v === 1 && Array.isArray(parsed.tasks)) return parsed;
  } catch {
    // Corrupt or unavailable storage: start from the seed.
  }
  return null;
}

export async function saveState(state: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage is best effort. The app keeps working in memory.
  }
}
