import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import { requestCheckIn, requestSteps } from './lib/api';
import {
  applyCheckIn,
  availableMinutes,
  createTask,
  dayLabel,
  fmtDuration,
  generateSteps,
  movesNeeded,
  moveTasks,
  newId,
  parseBrainDump,
  planTasks,
  seedState,
} from './lib/engine';
import { loadState, saveState } from './lib/storage';
import { palettes, type Palette } from './theme';
import type {
  AppState,
  ChatMessage,
  Day,
  Energy,
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

export const DEMO_CHIPS = [
  "Finish the quarterly report 2h, call the dentist, reply to Sam's email, gym at 6pm",
  "I'm tired today. Study for the chem exam 90m, laundry",
  'Tomorrow: write the essay intro, buy groceries',
  "I'm stuck on the budget spreadsheet",
];

const VOICE_SAMPLES = [
  'Draft the launch post for 1h, team standup at 10am, pay the electric bill',
  "I'm stuck on my thesis outline, also book flights",
];

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
  toggleNudges: () => void;
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
  voiceSample: () => string;
  demo: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [state, setState] = useState<AppState>(() => seedState());
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [typing, setTyping] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sheetTaskId, setSheetTaskId] = useState<string | null | undefined>(
    undefined,
  );
  const [timer, setTimer] = useState<TimerState>({
    stepId: null,
    secs: 600,
    running: false,
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const snapshotRef = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceIndex = useRef(0);

  // Load persisted state once.
  useEffect(() => {
    let active = true;
    loadState()
      .then((saved) => {
        if (!active) return;
        if (saved) setState(saved);
        setHydrated(true);
      })
      .catch(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Persist every meaningful change, after hydration.
  useEffect(() => {
    if (hydrated) void saveState(state);
  }, [state, hydrated]);

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

  // Timer tick.
  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => {
      setTimer((current) => {
        if (!current.running) return current;
        if (current.secs <= 1) {
          return { ...current, secs: 0, running: false };
        }
        return { ...current, secs: current.secs - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timer.running]);

  // Announce the end of a step exactly once.
  const announcedRef = useRef(false);
  useEffect(() => {
    if (timer.secs === 0 && timer.stepId && !announcedRef.current) {
      announcedRef.current = true;
      notify('Time is up for this step. Mark it done or reset.');
    }
    if (timer.secs > 0) announcedRef.current = false;
  }, [timer.secs, timer.stepId, notify]);

  const mode: ResolvedTheme =
    state.theme === 'auto'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : state.theme;
  const colors = palettes[mode];

  const snapshot = useCallback(() => {
    snapshotRef.current = JSON.stringify(stateRef.current.tasks);
  }, []);

  const undo = useCallback(() => {
    if (!snapshotRef.current) {
      notify('Nothing to undo.');
      return;
    }
    const restored = JSON.parse(snapshotRef.current) as Task[];
    snapshotRef.current = null;
    const current = stateRef.current;
    setState({
      ...current,
      tasks: planTasks(restored, current.startH, current.endH, current.energy),
    });
    notify('Undone.');
  }, [notify]);

  const go = useCallback((next: Screen) => {
    setScreen(next);
  }, []);

  const setEnergy = useCallback(
    (energy: Energy) => {
      const current = stateRef.current;
      setState({
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
    [notify],
  );

  const setView = useCallback((day: Day) => {
    setState((current) => ({ ...current, view: day }));
  }, []);

  const setThemeMode = useCallback((theme: ThemeMode) => {
    setState((current) => ({ ...current, theme }));
  }, []);

  const setName = useCallback(
    (name: string) => {
      const clean = name.trim().slice(0, 24) || 'Alex';
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
      setState({
        ...current,
        startH,
        endH,
        tasks: planTasks(current.tasks, startH, endH, current.energy),
      });
      notify('Working hours saved.');
      return true;
    },
    [notify],
  );

  const toggleNudges = useCallback(() => {
    setState((current) => ({ ...current, nudges: !current.nudges }));
  }, []);

  const toggleTask = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const target = current.tasks.find((task) => task.id === id);
      if (!target) return;
      const done = !target.done;
      setState({
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
    [notify],
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
                start: fixed ? draft.start : null,
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

      setState({
        ...current,
        tasks: planTasks(tasks, current.startH, current.endH, current.energy),
      });
      setSheetTaskId(undefined);
      notify(draft.id ? 'Task updated.' : 'Task added.');
    },
    [notify, snapshot],
  );

  const deleteTask = useCallback(
    (id: string) => {
      snapshot();
      const current = stateRef.current;
      setState({
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
    },
    [notify, snapshot],
  );

  const applyTaskSteps = useCallback(
    (taskId: string, steps: Step[]) => {
      const current = stateRef.current;
      setState({
        ...current,
        focusId: taskId,
        tasks: current.tasks.map((task) =>
          task.id === taskId ? { ...task, steps } : task,
        ),
      });
      setTimer({ stepId: null, secs: 600, running: false });
    },
    [],
  );

  const addStep = useCallback(
    (taskId: string, text: string) => {
      const clean = text.trim().slice(0, 80);
      if (!clean) return;
      setState((current) => ({
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
      }));
    },
    [],
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
      setTimer({ stepId: null, secs: 600, running: false });
      setState({
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
    [notify],
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
      setTimer({ stepId: null, secs: 600, running: false });
      setState({
        ...current,
        tasks: current.tasks.map((item) =>
          item.id === taskId ? { ...item, steps } : item,
        ),
        focusId: taskId,
      });
      notify('Made it smaller.');
    },
    [notify],
  );

  const breakIntoSteps = useCallback(async (taskId: string) => {
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
  }, [applyTaskSteps]);

  const pushHistory = useCallback(
    (current: AppState, text: string): AppState => ({
      ...current,
      history: [
        { id: newId('h'), when: dayLabel(0), text },
        ...current.history,
      ].slice(0, 6),
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
        `${label} Day is now ${Math.round(
          (candidates.tasks
            .filter((task) => task.day === 'today')
            .reduce((total, task) => total + task.dur, 0) /
            availableMinutes(current.startH, current.endH, current.energy)) *
            100,
        )}% full.`,
      );
      setState(next);
      notify(label, true);
    },
    [notify, pushHistory, snapshot],
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
    setState({
      ...current,
      tasks: planTasks(tasks, current.startH, current.endH, current.energy),
    });
    notify(
      `Moved ${ids.size} task${ids.size > 1 ? 's' : ''} to tomorrow.`,
      true,
    );
  }, [notify, snapshot]);

  const setFocus = useCallback((id: string) => {
    setState((current) => ({ ...current, focusId: id }));
    setTimer({ stepId: null, secs: 600, running: false });
  }, []);

  const sendCheckIn = useCallback(
    async (raw: string) => {
      const text = raw.trim();
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
      setState(applied.state);
      setTyping(false);
    },
    [snapshot],
  );

  const timerToggle = useCallback(() => {
    setTimer((current) => {
      if (current.running) return { ...current, running: false };
      if (current.secs <= 0) return current;
      return { ...current, running: true };
    });
  }, []);

  const timerReset = useCallback((stepId: string, seconds: number) => {
    setTimer({ stepId, secs: seconds, running: false });
  }, []);

  const timerSkip = useCallback(() => {
    setTimer((current) => {
      const secs = Math.max(0, current.secs - 60);
      return { ...current, secs, running: secs === 0 ? false : current.running };
    });
  }, []);

  const syncTimer = useCallback((stepId: string, seconds: number) => {
    setTimer((current) =>
      current.stepId === stepId
        ? current
        : { stepId, secs: seconds, running: false },
    );
  }, []);

  const voiceSample = useCallback(() => {
    const sample = VOICE_SAMPLES[voiceIndex.current % VOICE_SAMPLES.length];
    voiceIndex.current += 1;
    return sample;
  }, []);

  const demo = useCallback(
    (id: string) => {
      if (id === 'dump') {
        setScreen('checkin');
        setTimeout(() => void sendCheckIn(DEMO_CHIPS[0]), 350);
        return;
      }
      if (id === 'overload') {
        snapshot();
        const current = stateRef.current;
        const tasks = [
          ...current.tasks,
          createTask('Write grant proposal', 180, 'high', 'today', 2),
          createTask('Client workshop prep', 120, 'high', 'today', 2),
          createTask('Inbox zero', 45, 'low', 'today', 2),
        ];
        setState({
          ...current,
          tasks: planTasks(tasks, current.startH, current.endH, current.energy),
        });
        setScreen('home');
        notify('Added 345 minutes of work.', true);
        return;
      }
      if (id === 'stuck') {
        const current = stateRef.current;
        const task =
          current.tasks.find(
            (item) =>
              item.title === 'Draft client proposal' && !item.done,
          ) ??
          current.tasks.find((item) => item.day === 'today' && !item.done);
        if (!task) return;
        const steps = task.steps.length ? task.steps : generateSteps(task.title);
        setState({
          ...current,
          focusId: task.id,
          tasks: current.tasks.map((item) =>
            item.id === task.id ? { ...item, steps } : item,
          ),
        });
        setScreen('focus');
        return;
      }
      if (id === 'tired') {
        const current = stateRef.current;
        setState({
          ...current,
          energy: 'low',
          tasks: planTasks(current.tasks, current.startH, current.endH, 'low'),
        });
        setScreen('home');
        notify(
          `Energy set to low. Open time today: ${fmtDuration(
            availableMinutes(current.startH, current.endH, 'low'),
          )}.`,
        );
        return;
      }
      if (id === 'reset') {
        setState(seedState());
        setTimer({ stepId: null, secs: 600, running: false });
        setScreen('home');
        setToast(null);
        notify('Demo reset.');
      }
    },
    [notify, sendCheckIn, snapshot],
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
      voiceSample,
      demo,
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
      voiceSample,
      demo,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
