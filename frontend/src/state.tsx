import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState as NativeAppState, useColorScheme } from 'react-native';

import { useAuth } from './auth';
import { checkBackend, requestCheckIn, requestSteps } from './lib/api';
import {
  deleteAllTasksRemote,
  deleteTaskRemote,
  fetchRemoteState,
  reconstructFromRemote,
  syncStepsForTask,
  upsertProfile,
  upsertTasks,
} from './lib/db';
import {
  applyCheckIn,
  applyOnboarding,
  availableMinutes,
  createTask,
  dayLabel,
  fmtDuration,
  generateSteps,
  initialState,
  movesNeeded,
  moveTasks,
  newId,
  parseBrainDump,
  planTasks,
  remainingSeconds,
  rollover,
  syncDaily,
  welcomeMessage,
} from './lib/engine';
import {
  cancelTaskNudges,
  cancelTimerNotification,
  ensureNotificationPermission,
  notificationsSupported,
  scheduleNextTaskNudge,
  scheduleTimerNotification,
  sendTestNotification,
  snoozeTaskNudge,
} from './lib/notifications';
import { clearState, loadState, saveState } from './lib/storage';
import { paletteFor, type Palette } from './theme';
import { supabase } from './lib/supabase';
import type {
  AiStatus,
  AppState,
  ChatMessage,
  Day,
  Energy,
  OnboardingProfile,
  ParsedCheckIn,
  ParsedStep,
  ResolvedTheme,
  Screen,
  Step,
  Task,
  TaskDraft,
  ThemeMode,
  TimerState,
  ToastState,
} from './types';

export interface NudgeInfo {
  at: Date;
  title: string;
}

interface AppContextValue {
  state: AppState;
  colors: Palette;
  mode: ResolvedTheme;
  hydrated: boolean;
  screen: Screen;
  go: (screen: Screen) => void;
  typing: boolean;
  timer: TimerState;
  toast: ToastState | null;
  sheetTaskId: string | null | undefined;
  openTaskSheet: (id: string | null) => void;
  closeTaskSheet: () => void;
  notify: (message: string, undo?: boolean) => void;
  undo: () => void;
  setEnergy: (energy: Energy) => void;
  setView: (day: Day) => void;
  setThemeMode: (theme: ThemeMode) => void;
  setName: (name: string) => void;
  setHours: (startH: number, endH: number) => boolean;
  setNudgeLead: (minutes: number) => void;
  toggleNudges: () => Promise<void>;
  toggleTask: (id: string) => void;
  saveTask: (draft: TaskDraft) => void;
  deleteTask: (id: string) => void;
  addStep: (taskId: string, text: string) => void;
  toggleStep: (taskId: string, stepId: string) => void;
  makeSmaller: (taskId: string) => void;
  breakIntoSteps: (taskId: string) => Promise<number>;
  moveSuggested: () => void;
  moveN: (count: number) => void;
  moveLoose: () => void;
  setFocus: (id: string) => void;
  sendCheckIn: (text: string) => Promise<void>;
  timerToggle: () => void;
  timerReset: (stepId: string, seconds: number) => void;
  timerSkip: () => void;
  syncTimer: (stepId: string, seconds: number) => void;
  completeOnboarding: (profile: OnboardingProfile) => Promise<void>;
  snoozeNudge: (taskId?: string, minutes?: number) => Promise<void>;
  checkAi: () => Promise<void>;
  aiStatus: AiStatus;
  aiInfo: Awaited<ReturnType<typeof checkBackend>>;
  exportData: () => string;
  resetPreferences: () => void;
  resetApp: () => Promise<void>;
  testNudge: () => Promise<void>;
  storageWarning: boolean;
  lastNudge: NudgeInfo | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

const EMPTY_TIMER: TimerState = {
  stepId: null,
  secs: 600,
  running: false,
  endsAt: null,
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const { user, hydrated: authHydrated } = useAuth();
  const [state, setState] = useState<AppState>(() => initialState());
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [typing, setTyping] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sheetTaskId, setSheetTaskId] = useState<string | null | undefined>(
    undefined,
  );
  const [timer, setTimer] = useState<TimerState>(EMPTY_TIMER);
  const [aiStatus, setAiStatus] = useState<AiStatus>('checking');
  const [aiInfo, setAiInfo] = useState<Awaited<ReturnType<typeof checkBackend>>>(
    null,
  );
  const [lastNudge, setLastNudge] = useState<NudgeInfo | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const snapshotRef = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeKeyRef = useRef('');

  const userId = user?.id ?? null;
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;

  // Load the plan that belongs to the signed-in account. `loadedFor` records
  // which account the in-memory state came from, so a sign-out/sign-in swap
  // can never write one user's plan into another user's key.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loadedForRef = useRef<string | null>(loadedFor);
  loadedForRef.current = loadedFor;

  useEffect(() => {
    if (!authHydrated) return;
    let active = true;

    if (!userId) {
      setState(initialState());
      setLoadedFor(null);
      setHydrated(true);
      return;
    }

    setHydrated(false);

    (async () => {
      try {
        // For guests, use local storage only
        if (user?.provider === 'guest') {
          const saved = await loadState(userId);
          if (!active) return;
          if (saved) {
            const { state: current } = rollover(saved);
            const planned = planTasks(
              current.tasks,
              current.startH,
              current.endH,
              current.energy,
            );
            setState(
              syncDaily({
                ...current,
                tasks: planned,
                chat: current.chat.length
                  ? current.chat
                  : [welcomeMessage(current.name)],
              }),
            );
          } else {
            setState(initialState());
          }
          setLoadedFor(userId);
          setHydrated(true);
          return;
        }

        // For authenticated users with Supabase, try remote first
        if (supabase) {
          try {
            const remote = await fetchRemoteState(userId);
            if (!active) return;

            // Check if we have remote data
            if (remote && (remote.tasks.length > 0 || remote.profile)) {
              const reconstructed = reconstructFromRemote(remote, initialState());
              if (reconstructed && active) {
                const { state: current } = rollover(reconstructed);
                const planned = planTasks(
                  current.tasks,
                  current.startH,
                  current.endH,
                  current.energy,
                );
                setState(
                  syncDaily({
                    ...current,
                    tasks: planned,
                    chat: current.chat.length
                      ? current.chat
                      : [welcomeMessage(current.name)],
                  }),
                );
                setLoadedFor(userId);
                setHydrated(true);
                return;
              }
            }

            // No remote data, check for local migration
            const saved = await loadState(userId);
            if (!active) return;
            if (saved) {
              const { state: current } = rollover(saved);
              const planned = planTasks(
                current.tasks,
                current.startH,
                current.endH,
                current.energy,
              );
              const migrated = syncDaily({
                ...current,
                tasks: planned,
                chat: current.chat.length
                  ? current.chat
                  : [welcomeMessage(current.name)],
              });
              setState(migrated);
              // Migrate to Supabase
              try {
                await upsertProfile(userId, migrated);
                await upsertTasks(userId, migrated.tasks);
                await Promise.all(migrated.tasks.map(t => syncStepsForTask(userId, t.id, t.steps)));
                console.log('[sync] Migrated local data to Supabase');
              } catch (e) {
                console.warn('[sync] Migration to Supabase failed', e);
              }
            } else {
              setState(initialState());
            }
            setLoadedFor(userId);
            setHydrated(true);
            return;
          } catch (e) {
            console.warn('[sync] Failed to fetch from Supabase, falling back to local', e);
          }
        }

        // Fallback to local storage
        const saved = await loadState(userId);
        if (!active) return;
        if (saved) {
          const { state: current } = rollover(saved);
          const planned = planTasks(
            current.tasks,
            current.startH,
            current.endH,
            current.energy,
          );
          setState(
            syncDaily({
              ...current,
              tasks: planned,
              chat: current.chat.length
                ? current.chat
                : [welcomeMessage(current.name)],
            }),
          );
        } else {
          setState(initialState());
        }
        setLoadedFor(userId);
        setHydrated(true);
      } catch (e) {
        if (!active) return;
        setLoadedFor(userId);
        setHydrated(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [authHydrated, userId, user?.provider]);

  // Persist every meaningful change after hydration, with a tiny debounce.
  useEffect(() => {
    if (!hydrated || !userId || loadedFor !== userId) return;
    let active = true;
    const id = setTimeout(async () => {
      // Always cache locally first
      const ok = await saveState(state, userId);
      if (!active) return;
      if (ok) setStorageWarning(false);
      else setStorageWarning(true);

      // Sync to Supabase for authenticated non-guest users
      if (user?.provider !== 'guest' && supabase) {
        try {
          await upsertProfile(userId, state);
          await upsertTasks(userId, state.tasks);
          // Sync steps per task
          await Promise.all(state.tasks.map(t => syncStepsForTask(userId, t.id, t.steps)));
        } catch (e) {
          console.warn('[sync] Failed to push to Supabase', e);
        }
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [state, hydrated, userId, loadedFor, user?.provider]);

  // Save immediately when the app is backgrounded.
  useEffect(() => {
    const subscription = NativeAppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        const owner = userIdRef.current;
        if (hydrated && owner && loadedForRef.current === owner) {
          void saveState(stateRef.current, owner);
        }
      }
      if (next === 'active') {
        setTimer((current) => {
          if (!current.running || current.endsAt == null) return current;
          const secs = Math.max(
            0,
            Math.ceil((current.endsAt - Date.now()) / 1000),
          );
          return {
            ...current,
            secs,
            running: secs > 0,
            endsAt: secs > 0 ? current.endsAt : null,
          };
        });
      }
    });
    return () => subscription.remove();
  }, [hydrated]);

  const notify = useCallback((message: string, undo = false) => {
    setToast({ message, undo });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const checkAi = useCallback(async () => {
    setAiStatus('checking');
    const health = await checkBackend();
    setAiInfo(health);
    setAiStatus(health ? 'online' : 'offline');
  }, []);

  useEffect(() => {
    if (hydrated) void checkAi();
  }, [hydrated, checkAi]);

  // Accurate timer: keep counting from a deadline, not from interval ticks.
  useEffect(() => {
    if (!timer.running) return;
    const tick = () => {
      setTimer((current) => {
        if (!current.running || current.endsAt == null) return current;
        const secs = Math.max(
          0,
          Math.ceil((current.endsAt - Date.now()) / 1000),
        );
        if (secs === current.secs) return current;
        return {
          ...current,
          secs,
          running: secs > 0,
          endsAt: secs > 0 ? current.endsAt : null,
        };
      });
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timer.running]);

  const announcedRef = useRef(false);
  useEffect(() => {
    if (timer.secs === 0 && timer.stepId && !announcedRef.current) {
      announcedRef.current = true;
      notify('Time is up for this step. Mark it done or reset.');
    }
    if (timer.secs > 0) announcedRef.current = false;
  }, [timer.secs, timer.stepId, notify]);

  // Schedule a real device nudge for the next timed task.
  useEffect(() => {
    if (!hydrated) return;
    if (!state.nudges) {
      setLastNudge(null);
      nudgeKeyRef.current = '';
      void cancelTaskNudges();
      return;
    }
    const key = JSON.stringify({
      lead: state.nudgeLeadMin,
      tasks: state.tasks
        .filter((task) => task.day === 'today' && !task.done && task.start != null)
        .map((task) => [task.id, task.start, task.title]),
    });
    if (nudgeKeyRef.current === key) return;
    nudgeKeyRef.current = key;
    let active = true;
    void scheduleNextTaskNudge(state.tasks, state.nudgeLeadMin).then((nudge) => {
      if (!active) return;
      setLastNudge(nudge ? { at: nudge.at, title: nudge.title } : null);
    });
    return () => {
      active = false;
    };
  }, [
    hydrated,
    state.nudges,
    state.nudgeLeadMin,
    state.tasks,
  ]);

  const mode: ResolvedTheme =
    state.theme === 'auto'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : state.theme;
  const colors = paletteFor(mode);

  const snapshot = useCallback(() => {
    snapshotRef.current = JSON.stringify(stateRef.current.tasks);
  }, []);

  const commit = useCallback((next: AppState) => {
    setState(syncDaily(next));
  }, []);

  const updateTimer = useCallback(
    (next: TimerState) => {
      timerRef.current = next;
      setTimer(next);
    },
    [],
  );

  const undo = useCallback(() => {
    if (!snapshotRef.current) {
      notify('Nothing to undo.');
      return;
    }
    const restored = JSON.parse(snapshotRef.current) as Task[];
    snapshotRef.current = null;
    const current = stateRef.current;
    commit({
      ...current,
      tasks: planTasks(restored, current.startH, current.endH, current.energy),
    });
    notify('Undone.');
  }, [commit, notify]);

  const go = useCallback((next: Screen) => {
    setScreen(next);
  }, []);

  const setEnergy = useCallback(
    (energy: Energy) => {
      const current = stateRef.current;
      commit({
        ...current,
        energy,
        tasks: planTasks(current.tasks, current.startH, current.endH, energy),
      });
      notify(
        `Energy set to ${energy}. Open time today: ${fmtDuration(
          availableMinutes(current.startH, current.endH, energy),
        )}.`,
      );
    },
    [commit, notify],
  );

  const setView = useCallback((day: Day) => {
    setState((current) => ({ ...current, view: day }));
  }, []);

  const setThemeMode = useCallback((theme: ThemeMode) => {
    setState((current) => ({ ...current, theme }));
  }, []);

  const setName = useCallback(
    (name: string) => {
      const clean = name.trim().slice(0, 24);
      if (!clean) {
        notify('Add a name so greetings feel right.');
        return;
      }
      setState((current) => ({ ...current, name: clean }));
      notify('Name saved.');
    },
    [notify],
  );

  const setHours = useCallback(
    (startH: number, endH: number) => {
      if (endH <= startH) {
        notify('Your day must end after it starts.');
        return false;
      }
      const current = stateRef.current;
      commit({
        ...current,
        startH,
        endH,
        tasks: planTasks(current.tasks, startH, endH, current.energy),
      });
      notify('Working hours saved.');
      return true;
    },
    [commit, notify],
  );

  const setNudgeLead = useCallback((minutes: number) => {
    const clean = Math.max(0, Math.min(60, Math.round(minutes)));
    setState((current) => ({ ...current, nudgeLeadMin: clean }));
  }, []);

  const toggleNudges = useCallback(async () => {
    const current = stateRef.current;
    if (current.nudges) {
      setState({ ...current, nudges: false });
      setLastNudge(null);
      await cancelTaskNudges();
      notify('Nudges off.');
      return;
    }
    if (!notificationsSupported()) {
      setState({ ...current, nudges: true });
      notify(
        'Device notifications are not available in the browser. In-app nudges stay on Home.',
      );
      return;
    }
    const granted = await ensureNotificationPermission();
    if (!granted) {
      notify(
        'Notification permission was denied. Enable it in your device settings to get nudges.',
      );
      return;
    }
    setState({ ...current, nudges: true });
    notify('Nudges on. I will remind you before planned tasks.');
  }, [notify]);

  const toggleTask = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const target = current.tasks.find((task) => task.id === id);
      if (!target) return;
      const done = !target.done;
      commit({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === id
            ? {
                ...task,
                done,
                steps: done
                  ? task.steps.map((step) => ({ ...step, done: true }))
                  : task.steps,
              }
            : task,
        ),
      });
      if (done) notify(`Done: ${target.title}`);
    },
    [commit, notify],
  );

  const closeTaskSheet = useCallback(() => setSheetTaskId(undefined), []);
  const openTaskSheet = useCallback((id: string | null) => {
    setSheetTaskId(id ?? null);
  }, []);

  const saveTask = useCallback(
    (draft: TaskDraft) => {
      snapshot();
      const current = stateRef.current;
      const fixed = draft.start != null;
      let tasks: Task[];

      if (draft.id) {
        tasks = current.tasks.map((task) =>
          task.id === draft.id
            ? {
                ...task,
                title: draft.title.trim(),
                dur: draft.dur,
                effort: draft.effort,
                day: draft.day,
                pri: draft.pri,
                start: fixed
                  ? draft.start
                  : task.done
                    ? task.start
                    : null,
                fixed,
              }
            : task,
        );
      } else {
        tasks = [
          ...current.tasks,
          createTask(
            draft.title.trim(),
            draft.dur,
            draft.effort,
            draft.day,
            draft.pri,
            fixed ? draft.start : null,
            fixed,
          ),
        ];
      }

      commit({
        ...current,
        tasks: planTasks(tasks, current.startH, current.endH, current.energy),
      });
      setSheetTaskId(undefined);
      notify(draft.id ? 'Task updated.' : 'Task added.');
    },
    [commit, notify, snapshot],
  );

  const deleteTask = useCallback(
    (id: string) => {
      snapshot();
      const current = stateRef.current;
      commit({
        ...current,
        tasks: planTasks(
          current.tasks.filter((task) => task.id !== id),
          current.startH,
          current.endH,
          current.energy,
        ),
      });
      setSheetTaskId(undefined);
      notify('Task deleted.', true);
      // Sync deletion to Supabase for authenticated non-guest users
      if (user?.provider !== 'guest' && supabase && userIdRef.current) {
        void deleteTaskRemote(userIdRef.current, id).catch((e) =>
          console.warn('[sync] Failed to delete task from Supabase', e),
        );
      }
    },
    [commit, notify, snapshot, user?.provider],
  );

  const applyTaskSteps = useCallback(
    (taskId: string, steps: Step[]) => {
      const current = stateRef.current;
      commit({
        ...current,
        focusId: taskId,
        tasks: current.tasks.map((task) =>
          task.id === taskId ? { ...task, steps } : task,
        ),
      });
      void cancelTimerNotification();
      updateTimer(EMPTY_TIMER);
    },
    [commit, updateTimer],
  );

  const addStep = useCallback(
    (taskId: string, text: string) => {
      const clean = text.trim().slice(0, 80);
      if (!clean) return;
      const current = stateRef.current;
      commit({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                steps: [
                  ...task.steps,
                  { id: newId('s'), text: clean, min: 10, done: false },
                ],
              }
            : task,
        ),
      });
    },
    [commit],
  );

  const toggleStep = useCallback(
    (taskId: string, stepId: string) => {
      const current = stateRef.current;
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task) return;

      const steps = task.steps.map((step) =>
        step.id === stepId ? { ...step, done: !step.done } : step,
      );
      const allDone = steps.length > 0 && steps.every((step) => step.done);
      void cancelTimerNotification();
      updateTimer(EMPTY_TIMER);
      commit({
        ...current,
        tasks: current.tasks.map((item) =>
          item.id === taskId
            ? { ...item, steps, done: allDone ? true : item.done }
            : item,
        ),
        focusId: taskId,
      });
      if (allDone) notify(`Finished: ${task.title}. Nice work.`);
      else notify('Step done.');
    },
    [commit, notify, updateTimer],
  );

  const makeSmaller = useCallback(
    (taskId: string) => {
      const current = stateRef.current;
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task) return;
      const index = task.steps.findIndex((step) => !step.done);
      if (index < 0) return;
      const step = task.steps[index];
      const smaller = [
        {
          id: newId('s'),
          text: `Get set up: ${step.text.toLowerCase()}`,
          min: 1,
          done: false,
        },
        {
          id: newId('s'),
          text: `Do only 2 minutes of: ${step.text.toLowerCase()}`,
          min: 2,
          done: false,
        },
      ];
      const steps = [...task.steps];
      steps.splice(index, 1, ...smaller);
      void cancelTimerNotification();
      updateTimer(EMPTY_TIMER);
      commit({
        ...current,
        tasks: current.tasks.map((item) =>
          item.id === taskId ? { ...item, steps } : item,
        ),
        focusId: taskId,
      });
      notify('Made it smaller.');
    },
    [commit, notify, updateTimer],
  );

  const breakIntoSteps = useCallback(
    async (taskId: string) => {
      const task = stateRef.current.tasks.find((item) => item.id === taskId);
      if (!task) return 0;
      const fallback = generateSteps(task.title);
      const response = await requestSteps(task.title, task.effort);
      const source: ParsedStep[] | null = response?.steps ?? null;
      const steps: Step[] = source
        ? source.map((step) => ({
            id: step.id ?? newId('s'),
            text: step.text,
            min: step.min,
            done: step.done ?? false,
          }))
        : fallback;
      applyTaskSteps(taskId, steps);
      return steps.length;
    },
    [applyTaskSteps],
  );

  const pushHistory = useCallback(
    (current: AppState, text: string): AppState => ({
      ...current,
      history: [
        { id: newId('h'), when: dayLabel(0), text },
        ...current.history,
      ].slice(0, 20),
    }),
    [],
  );

  const moveN = useCallback(
    (count: number) => {
      const current = stateRef.current;
      const candidates = moveTasks(current, count);
      if (!candidates.moved.length) {
        notify('Nothing left to move.');
        return;
      }
      snapshot();
      const label =
        candidates.moved.length === 1
          ? `Moved "${candidates.moved[0].title}" to tomorrow.`
          : `Moved ${candidates.moved.length} tasks to tomorrow.`;
      const next = pushHistory(
        {
          ...current,
          tasks: candidates.tasks,
        },
        label,
      );
      commit(next);
      notify(label, true);
    },
    [commit, notify, pushHistory, snapshot],
  );

  const moveSuggested = useCallback(() => {
    const current = stateRef.current;
    moveN(movesNeeded(current));
  }, [moveN]);

  const moveLoose = useCallback(() => {
    const current = stateRef.current;
    const ids = new Set(
      current.tasks
        .filter((task) => task.day === 'today' && task.start == null)
        .map((task) => task.id),
    );
    if (!ids.size) return;
    snapshot();
    const tasks = current.tasks.map((task) =>
      ids.has(task.id)
        ? { ...task, day: 'tomorrow' as Day, fixed: false, start: null }
        : task,
    );
    commit({
      ...current,
      tasks: planTasks(tasks, current.startH, current.endH, current.energy),
    });
    notify(
      `Moved ${ids.size} task${ids.size > 1 ? 's' : ''} to tomorrow.`,
      true,
    );
  }, [commit, notify, snapshot]);

  const setFocus = useCallback(
    (id: string) => {
      setState((current) => ({ ...current, focusId: id }));
      void cancelTimerNotification();
      updateTimer(EMPTY_TIMER);
    },
    [updateTimer],
  );

  const sendCheckIn = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, 4000);
      if (!text) return;
      setScreen('checkin');
      const userMessage: ChatMessage = {
        id: newId('m'),
        from: 'me',
        text,
      };
      setState((current) => ({
        ...current,
        chat: [...current.chat, userMessage],
      }));
      setTyping(true);

      const snapshotState = stateRef.current;
      const response = await requestCheckIn(
        text,
        snapshotState.energy,
        snapshotState.startH,
        snapshotState.endH,
      );
      const local = parseBrainDump(text);
      const parsed: ParsedCheckIn = response ?? {
        items: local.items,
        energy: local.energy,
        reply: '',
        source: 'offline',
      };

      if (parsed.items.length || parsed.energy) snapshot();
      const latest = stateRef.current;
      const base = latest.chat.some((message) => message.id === userMessage.id)
        ? latest
        : { ...latest, chat: [...latest.chat, userMessage] };
      const applied = applyCheckIn(base, parsed);
      commit(applied.state);
      setTyping(false);
    },
    [commit, snapshot],
  );

  const completeOnboarding = useCallback(
    async (profile: OnboardingProfile) => {
      let nudges = profile.nudges;
      if (nudges) {
        if (!notificationsSupported()) {
          nudges = false;
          notify(
            'Device notifications are not available in the browser. In-app nudges will still appear on Home.',
          );
        } else {
          const granted = await ensureNotificationPermission();
          if (!granted) {
            nudges = false;
            notify(
              'Notification permission was not granted. You can enable it later in Profile.',
            );
          }
        }
      }
      const next = applyOnboarding(stateRef.current, { ...profile, nudges });
      commit(next);
      setScreen('home');
      notify(`Welcome, ${next.name.split(/\s+/)[0] || 'there'}.`);
    },
    [commit, notify],
  );

  const snoozeNudge = useCallback(
    async (taskId?: string, minutes = 15) => {
      const current = stateRef.current;
      const task =
        current.tasks.find((item) => item.id === taskId) ??
        current.tasks.find((item) => item.day === 'today' && !item.done);
      if (!task) {
        notify('Nothing to remind you about right now.');
        return;
      }
      const ok = await snoozeTaskNudge(task, minutes);
      notify(
        ok
          ? `Okay. I will nudge you again in ${minutes} minutes.`
          : `Reminder kept on Home. Device notifications are unavailable.`,
      );
    },
    [notify],
  );

  const testNudge = useCallback(async () => {
    const ok = await sendTestNotification();
    notify(
      ok
        ? 'Test notification sent. Check your notification tray.'
        : 'Device notifications are not available here. In-app nudges still work.',
    );
  }, [notify]);

  const exportData = useCallback(
    () =>
      JSON.stringify(
        {
          app: 'NudgePlan',
          schema: 2,
          exportedAt: new Date().toISOString(),
          data: stateRef.current,
        },
        null,
        2,
      ),
    [],
  );

  const resetApp = useCallback(async () => {
    await cancelTaskNudges();
    await cancelTimerNotification();
    await clearState(userIdRef.current);
    // Clear from Supabase for authenticated non-guest users
    if (user?.provider !== 'guest' && supabase && userIdRef.current) {
      void deleteAllTasksRemote(userIdRef.current).catch((e) =>
        console.warn('[sync] Failed to clear tasks from Supabase', e),
      );
    }
    nudgeKeyRef.current = '';
    setState(initialState());
    updateTimer(EMPTY_TIMER);
    setLastNudge(null);
    setScreen('home');
    setToast(null);
    setStorageWarning(false);
  }, [updateTimer, user?.provider]);

  const resetPreferences = useCallback(() => {
    const current = stateRef.current;
    commit({
      ...current,
      startH: 9,
      endH: 18,
      energy: 'medium',
      nudges: true,
      nudgeLeadMin: 15,
      theme: 'light',
    });
    notify('Preferences reset.');
  }, [commit, notify]);

  const timerTaskTitle = useCallback(() => {
    const current = stateRef.current;
    return (
      current.tasks.find((task) => task.id === current.focusId)?.title ??
      current.tasks.find((task) => task.day === 'today' && !task.done)?.title ??
      'your focus step'
    );
  }, []);

  const timerToggle = useCallback(() => {
    const current = timerRef.current;
    if (current.running) {
      const secs = remainingSeconds(current);
      void cancelTimerNotification();
      updateTimer({ ...current, secs, running: false, endsAt: null });
      return;
    }
    if (current.secs <= 0) return;
    void scheduleTimerNotification(current.secs, timerTaskTitle());
    updateTimer({
      ...current,
      running: true,
      endsAt: Date.now() + current.secs * 1000,
    });
  }, [timerTaskTitle, updateTimer]);

  const timerReset = useCallback(
    (stepId: string, seconds: number) => {
      void cancelTimerNotification();
      updateTimer({ stepId, secs: seconds, running: false, endsAt: null });
    },
    [updateTimer],
  );

  const timerSkip = useCallback(() => {
    const current = timerRef.current;
    const secs = Math.max(0, remainingSeconds(current) - 60);
    const keepRunning = current.running && secs > 0;
    if (current.running) {
      if (keepRunning) {
        void scheduleTimerNotification(secs, timerTaskTitle());
      } else {
        void cancelTimerNotification();
      }
    }
    updateTimer({
      ...current,
      secs,
      running: keepRunning,
      endsAt: keepRunning ? Date.now() + secs * 1000 : null,
    });
  }, [timerTaskTitle, updateTimer]);

  const syncTimer = useCallback(
    (stepId: string, seconds: number) => {
      if (timerRef.current.stepId === stepId) return;
      void cancelTimerNotification();
      updateTimer({ stepId, secs: seconds, running: false, endsAt: null });
    },
    [updateTimer],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      colors,
      mode,
      hydrated,
      screen,
      go,
      typing,
      timer,
      toast,
      sheetTaskId,
      openTaskSheet,
      closeTaskSheet,
      notify,
      undo,
      setEnergy,
      setView,
      setThemeMode,
      setName,
      setHours,
      setNudgeLead,
      toggleNudges,
      toggleTask,
      saveTask,
      deleteTask,
      addStep,
      toggleStep,
      makeSmaller,
      breakIntoSteps,
      moveSuggested,
      moveN,
      moveLoose,
      setFocus,
      sendCheckIn,
      timerToggle,
      timerReset,
      timerSkip,
      syncTimer,
      completeOnboarding,
      snoozeNudge,
      checkAi,
      aiStatus,
      aiInfo,
      exportData,
      resetApp,
      resetPreferences,
      testNudge,
      storageWarning,
      lastNudge,
    }),
    [
      state,
      colors,
      mode,
      hydrated,
      screen,
      go,
      typing,
      timer,
      toast,
      sheetTaskId,
      openTaskSheet,
      closeTaskSheet,
      notify,
      undo,
      setEnergy,
      setView,
      setThemeMode,
      setName,
      setHours,
      setNudgeLead,
      toggleNudges,
      toggleTask,
      saveTask,
      deleteTask,
      addStep,
      toggleStep,
      makeSmaller,
      breakIntoSteps,
      moveSuggested,
      moveN,
      moveLoose,
      setFocus,
      sendCheckIn,
      timerToggle,
      timerReset,
      timerSkip,
      syncTimer,
      completeOnboarding,
      snoozeNudge,
      checkAi,
      aiStatus,
      aiInfo,
      exportData,
      resetApp,
      resetPreferences,
      testNudge,
      storageWarning,
      lastNudge,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
