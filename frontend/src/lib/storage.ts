import AsyncStorage from '@react-native-async-storage/async-storage';

import { initialState, todayIso } from './engine';
import type { AppState, Task } from '../types';

const KEY = 'nudgeplan-app-2';
const LEGACY_KEY = 'nudgeplan-app-1';

const DEMO_TITLES = [
  'Deep work: research',
  'Draft client proposal',
  'Prep slides for Friday',
  'Reply to emails',
  'Review pull requests',
  'Team sync',
  'Weekly planning',
];

function looksLikeDemo(raw: Record<string, unknown>): boolean {
  if (raw.name !== 'Alex') return false;
  const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  if (tasks.length !== DEMO_TITLES.length) return false;
  const titles = tasks
    .map((task) => (task as { title?: unknown }).title)
    .filter((title): title is string => typeof title === 'string')
    .sort();
  return titles.join('|') === DEMO_TITLES.join('|');
}

function normaliseTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== 'object') return null;
  const task = raw as Record<string, unknown>;
  if (typeof task.title !== 'string' || !task.title.trim()) return null;
  const steps = Array.isArray(task.steps) ? task.steps : [];
  return {
    id: typeof task.id === 'string' ? task.id : `t${Date.now()}`,
    title: task.title.slice(0, 70),
    dur: typeof task.dur === 'number' ? task.dur : 45,
    effort:
      task.effort === 'low' || task.effort === 'high' ? task.effort : 'med',
    day: task.day === 'tomorrow' ? 'tomorrow' : 'today',
    pri: task.pri === 1 || task.pri === 3 ? task.pri : 2,
    start: typeof task.start === 'number' ? task.start : null,
    fixed: Boolean(task.fixed),
    done: Boolean(task.done),
    steps: steps
      .filter((step): step is Record<string, unknown> => !!step && typeof step === 'object')
      .map((step, index) => ({
        id: typeof step.id === 'string' ? step.id : `s${Date.now()}${index}`,
        text: typeof step.text === 'string' ? step.text.slice(0, 120) : '',
        min: typeof step.min === 'number' ? step.min : 5,
        done: Boolean(step.done),
      }))
      .filter((step) => step.text.length > 0),
  };
}

/** Fill in anything a previous schema version did not have. */
function normalise(raw: Record<string, unknown>): AppState | null {
  if (!Array.isArray(raw.tasks)) return null;
  const base = initialState();
  const tasks = raw.tasks
    .map(normaliseTask)
    .filter((task): task is Task => task != null);

  return {
    ...base,
    ...raw,
    v: 2,
    onboarded: Boolean(raw.onboarded ?? String(raw.name ?? '').trim()),
    name: typeof raw.name === 'string' ? raw.name.slice(0, 24) : '',
    startH: typeof raw.startH === 'number' ? raw.startH : base.startH,
    endH: typeof raw.endH === 'number' ? raw.endH : base.endH,
    energy:
      raw.energy === 'low' || raw.energy === 'high' ? raw.energy : 'medium',
    nudges: raw.nudges !== false,
    nudgeLeadMin:
      typeof raw.nudgeLeadMin === 'number' ? raw.nudgeLeadMin : base.nudgeLeadMin,
    theme:
      raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'auto',
    themeScheme: 'clean-mist',
    view: raw.view === 'tomorrow' ? 'tomorrow' : 'today',
    focusId: typeof raw.focusId === 'string' ? raw.focusId : null,
    chat: Array.isArray(raw.chat) ? raw.chat : [],
    checkins: Array.isArray(raw.checkins) ? raw.checkins : [],
    history: Array.isArray(raw.history) ? raw.history : [],
    daily: Array.isArray(raw.daily) ? raw.daily : [],
    lastActiveDate:
      typeof raw.lastActiveDate === 'string'
        ? raw.lastActiveDate
        : todayIso(0),
    tasks,
  } as AppState;
}

export async function loadState(): Promise<AppState | null> {
  try {
    const current = await AsyncStorage.getItem(KEY);
    if (current) {
      const parsed = JSON.parse(current) as Record<string, unknown>;
      if (parsed?.v === 2) return normalise(parsed);
    }

    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (!legacy) return null;
    const parsed = JSON.parse(legacy) as Record<string, unknown>;
    if (parsed?.v !== 1) return null;
    // The old prototype shipped with fake tasks. Do not carry those into a
    // real account; start clean instead.
    if (looksLikeDemo(parsed)) {
      await AsyncStorage.removeItem(LEGACY_KEY);
      return null;
    }
    const migrated = normalise(parsed);
    if (migrated) {
      await AsyncStorage.setItem(KEY, JSON.stringify(migrated));
      await AsyncStorage.removeItem(LEGACY_KEY);
    }
    return migrated;
  } catch {
    // Corrupt or unavailable storage: start from a clean install.
    return null;
  }
}

export async function saveState(state: AppState): Promise<boolean> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    // Storage is best effort. The app keeps working in memory.
    return false;
  }
}

export async function clearState(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEY, LEGACY_KEY]);
  } catch {
    // Nothing else to do; the caller resets the in-memory state.
  }
}
