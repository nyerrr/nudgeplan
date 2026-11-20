import AsyncStorage from '@react-native-async-storage/async-storage';

import { initialState, todayIso } from './engine';
import type { AppState, PendingCheckInReview, Task } from '../types';

const BASE_KEY = 'nudgeplan-app-2';
const LEGACY_KEY = 'nudgeplan-app-1';
const GUEST_ID = 'guest-local';

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
    dueDate:
      typeof task.dueDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)
        ? task.dueDate
        : null,
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

/** Plans are scoped per account so signing in as someone else starts clean. */
function keyFor(userId?: string | null): string {
  return `${BASE_KEY}-${userId || GUEST_ID}`;
}

function pendingDeletesKey(userId: string): string {
  return `nudgeplan-pending-deletes-2-${userId}`;
}

function pendingReviewKey(userId: string): string {
  return `nudgeplan-pending-review-2-${userId}`;
}

function isTaskProposal(value: unknown): value is PendingCheckInReview['proposals'][number] {
  if (!value || typeof value !== 'object') return false;
  const proposal = value as Record<string, unknown>;
  return (
    typeof proposal.key === 'string' &&
    typeof proposal.title === 'string' &&
    typeof proposal.durationText === 'string' &&
    typeof proposal.effort === 'string' &&
    typeof proposal.day === 'string' &&
    typeof proposal.priority === 'number' &&
    typeof proposal.startText === 'string' &&
    typeof proposal.dueText === 'string' &&
    Array.isArray(proposal.warnings) &&
    proposal.warnings.every((warning) => typeof warning === 'string') &&
    Array.isArray(proposal.steps) &&
    proposal.steps.every(
      (step) =>
        step &&
        typeof step === 'object' &&
        typeof (step as Record<string, unknown>).key === 'string' &&
        typeof (step as Record<string, unknown>).text === 'string' &&
        typeof (step as Record<string, unknown>).minutesText === 'string',
    )
  );
}

function isPendingReview(value: unknown): value is PendingCheckInReview {
  if (!value || typeof value !== 'object') return false;
  const review = value as Record<string, unknown>;
  if (!review.parsed || typeof review.parsed !== 'object') return false;
  const parsed = review.parsed as Record<string, unknown>;
  const validParsed =
    Array.isArray(parsed.items) &&
    typeof parsed.reply === 'string' &&
    (parsed.energy === null || typeof parsed.energy === 'string') &&
    (parsed.source === undefined || typeof parsed.source === 'string');
  return (
    validParsed &&
    Array.isArray(review.proposals) &&
    review.proposals.every(isTaskProposal)
  );
}

let pendingDeleteQueue: Promise<void> = Promise.resolve();

export async function loadPendingDeletes(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(pendingDeletesKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function addPendingDelete(userId: string, taskId: string): Promise<void> {
  pendingDeleteQueue = pendingDeleteQueue
    .catch(() => undefined)
    .then(async () => {
      const ids = new Set(await loadPendingDeletes(userId));
      ids.add(taskId);
      await AsyncStorage.setItem(pendingDeletesKey(userId), JSON.stringify([...ids]));
    });
  return pendingDeleteQueue;
}

export async function clearPendingDelete(userId: string, taskId: string): Promise<void> {
  pendingDeleteQueue = pendingDeleteQueue
    .catch(() => undefined)
    .then(async () => {
      const ids = new Set(await loadPendingDeletes(userId));
      ids.delete(taskId);
      if (ids.size) {
        await AsyncStorage.setItem(pendingDeletesKey(userId), JSON.stringify([...ids]));
      } else {
        await AsyncStorage.removeItem(pendingDeletesKey(userId));
      }
    });
  return pendingDeleteQueue;
}

export async function clearAllPendingDeletes(userId: string): Promise<void> {
  pendingDeleteQueue = pendingDeleteQueue
    .catch(() => undefined)
    .then(async () => {
      await AsyncStorage.removeItem(pendingDeletesKey(userId));
    });
  return pendingDeleteQueue;
}

/** An unconfirmed check-in must survive an app restart; otherwise the user's
 *  message stays in chat but its proposed tasks are lost. */
export async function loadPendingReview(
  userId: string,
): Promise<PendingCheckInReview | null> {
  try {
    const raw = await AsyncStorage.getItem(pendingReviewKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPendingReview(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function savePendingReview(
  userId: string,
  review: PendingCheckInReview | null,
): Promise<void> {
  try {
    if (review) {
      await AsyncStorage.setItem(pendingReviewKey(userId), JSON.stringify(review));
    } else {
      await AsyncStorage.removeItem(pendingReviewKey(userId));
    }
  } catch {
    // Best effort: the in-memory review still works for this session.
  }
}

export async function loadState(userId?: string | null): Promise<AppState | null> {
  const key = keyFor(userId);
  try {
    const current = await AsyncStorage.getItem(key);
    if (current) {
      const parsed = JSON.parse(current) as Record<string, unknown>;
      if (parsed?.v === 2) return normalise(parsed);
    }

    // Adopt the pre-accounts single-user blob once, so the first sign-in keeps
    // the plan that was already on this device.
    if (key !== BASE_KEY) {
      const unowned = await AsyncStorage.getItem(BASE_KEY);
      if (unowned) {
        const parsed = JSON.parse(unowned) as Record<string, unknown>;
        if (parsed?.v === 2) {
          const adopted = normalise(parsed);
          if (adopted) {
            await AsyncStorage.setItem(key, JSON.stringify(adopted));
            await AsyncStorage.removeItem(BASE_KEY);
            return adopted;
          }
        }
      }
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
      await AsyncStorage.setItem(key, JSON.stringify(migrated));
      await AsyncStorage.removeItem(LEGACY_KEY);
    }
    return migrated;
  } catch {
    // Corrupt or unavailable storage: start from a clean install.
    return null;
  }
}

export async function saveState(
  state: AppState,
  userId?: string | null,
): Promise<boolean> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(state));
    return true;
  } catch {
    // Storage is best effort. The app keeps working in memory.
    return false;
  }
}

export async function clearState(userId?: string | null): Promise<void> {
  try {
    await AsyncStorage.multiRemove([keyFor(userId), LEGACY_KEY]);
  } catch {
    // Nothing else to do; the caller resets the in-memory state.
  }
}
