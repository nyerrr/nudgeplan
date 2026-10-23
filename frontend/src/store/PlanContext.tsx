import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import { capacityMinutes } from '../lib/realityCheck';
import { EnergyLevel, PendingTask, Task } from '../theme';

/**
 * The whole app state, in one reducer.
 *
 * There is no seed data: a fresh install starts empty and stays empty until
 * the backend turns a brain dump into tasks. Persistence (Supabase) is Phase 3;
 * today a reload starts over on purpose.
 */

type CheckIn = { hours: number; energy: EnergyLevel };

type PlanMeta = {
  /** Which model produced the tasks that are currently pending. */
  model: string;
  /** The planner's one-line explanation of the plan. */
  breakdown: string;
};

type State = {
  tasks: Task[];
  /** Tasks extracted from a brain dump, awaiting confirmation. */
  pending: PendingTask[];
  checkIn: CheckIn;
  /** Provenance for the pending tasks, shown on the confirmation screen. */
  lastPlan: PlanMeta | null;
};

type Action =
  | { type: 'toggle'; id: string }
  | { type: 'update'; id: string; patch: Partial<Task> }
  | { type: 'remove'; id: string }
  | { type: 'removeMany'; ids: string[] }
  | { type: 'setPending'; tasks: PendingTask[]; meta: PlanMeta }
  | { type: 'updatePending'; id: string; patch: Partial<PendingTask> }
  | { type: 'removePending'; id: string }
  | { type: 'commitPending' }
  | { type: 'clearPending' }
  | { type: 'setCheckIn'; patch: Partial<CheckIn> }
  | { type: 'reset' };

/** Neutral starting point: two usable hours, steady energy. Not a fake plan. */
export const DEFAULT_CHECK_IN: CheckIn = { hours: 2, energy: 'medium' };

const initialState: State = {
  tasks: [],
  pending: [],
  checkIn: DEFAULT_CHECK_IN,
  lastPlan: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'toggle':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id ? { ...task, done: !task.done } : task
        ),
      };
    case 'update':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id ? { ...task, ...action.patch } : task
        ),
      };
    case 'remove':
      return { ...state, tasks: state.tasks.filter((task) => task.id !== action.id) };
    case 'removeMany': {
      const ids = new Set(action.ids);
      return { ...state, tasks: state.tasks.filter((task) => !ids.has(task.id)) };
    }
    case 'setPending':
      return { ...state, pending: action.tasks, lastPlan: action.meta };
    case 'updatePending':
      return {
        ...state,
        pending: state.pending.map((task) =>
          task.id === action.id ? { ...task, ...action.patch } : task
        ),
      };
    case 'removePending':
      return { ...state, pending: state.pending.filter((task) => task.id !== action.id) };
    case 'commitPending':
      return {
        ...state,
        tasks: [...state.pending.map((task) => ({ ...task, done: false })), ...state.tasks],
        pending: [],
      };
    case 'clearPending':
      return { ...state, pending: [], lastPlan: null };
    case 'setCheckIn':
      return { ...state, checkIn: { ...state.checkIn, ...action.patch } };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

type Ctx = {
  state: State;
  toggleTask: (id: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  /** Remove several tasks at once (bulk delete on the Plan screen). */
  removeTasks: (ids: string[]) => void;
  updatePending: (id: string, patch: Partial<PendingTask>) => void;
  removePending: (id: string) => void;
  setPending: (tasks: PendingTask[], meta: PlanMeta) => void;
  commitPending: () => void;
  clearPending: () => void;
  setCheckIn: (patch: Partial<CheckIn>) => void;
  /** Wipe tasks, pending tasks, and check-in back to a clean slate. */
  resetAll: () => void;
  /** Tasks scheduled for today, deferred tasks excluded. */
  todaysTasks: Task[];
  deferredTasks: Task[];
  /** Sum of estimated minutes for today's tasks. */
  plannedMinutes: number;
  availableMinutes: number;
  /** availableMinutes adjusted for the energy check-in. The Reality Check yardstick. */
  capacityMinutes: number;
  /** plannedMinutes / capacityMinutes, can exceed 1. */
  overloadRatio: number;
  doneCount: number;
  progress: number;
};

const PlanContext = createContext<Ctx | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const todaysTasks = useMemo(
    () => state.tasks.filter((task) => !task.deferred),
    [state.tasks]
  );
  const deferredTasks = useMemo(
    () => state.tasks.filter((task) => task.deferred),
    [state.tasks]
  );

  const plannedMinutes = useMemo(
    () => todaysTasks.reduce((sum, task) => sum + task.minutes, 0),
    [todaysTasks]
  );
  const availableMinutes = state.checkIn.hours * 60;
  const capacity = capacityMinutes(availableMinutes, state.checkIn.energy);
  const doneCount = todaysTasks.filter((task) => task.done).length;
  const progress = todaysTasks.length === 0 ? 0 : doneCount / todaysTasks.length;

  const toggleTask = useCallback((id: string) => dispatch({ type: 'toggle', id }), []);
  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => dispatch({ type: 'update', id, patch }),
    []
  );
  const removeTask = useCallback((id: string) => dispatch({ type: 'remove', id }), []);
  const removeTasks = useCallback((ids: string[]) => dispatch({ type: 'removeMany', ids }), []);
  const updatePending = useCallback(
    (id: string, patch: Partial<PendingTask>) => dispatch({ type: 'updatePending', id, patch }),
    []
  );
  const removePending = useCallback(
    (id: string) => dispatch({ type: 'removePending', id }),
    []
  );
  const setPending = useCallback(
    (tasks: PendingTask[], meta: PlanMeta) => dispatch({ type: 'setPending', tasks, meta }),
    []
  );
  const commitPending = useCallback(() => dispatch({ type: 'commitPending' }), []);
  const clearPending = useCallback(() => dispatch({ type: 'clearPending' }), []);
  const setCheckIn = useCallback(
    (patch: Partial<CheckIn>) => dispatch({ type: 'setCheckIn', patch }),
    []
  );
  const resetAll = useCallback(() => dispatch({ type: 'reset' }), []);

  const value = useMemo<Ctx>(
    () => ({
      state,
      toggleTask,
      updateTask,
      removeTask,
      removeTasks,
      updatePending,
      removePending,
      setPending,
      commitPending,
      clearPending,
      setCheckIn,
      resetAll,
      todaysTasks,
      deferredTasks,
      plannedMinutes,
      availableMinutes,
      capacityMinutes: capacity,
      overloadRatio: capacity === 0 ? 0 : plannedMinutes / capacity,
      doneCount,
      progress,
    }),
    [
      state,
      toggleTask,
      updateTask,
      removeTask,
      removeTasks,
      updatePending,
      removePending,
      setPending,
      commitPending,
      clearPending,
      setCheckIn,
      resetAll,
      todaysTasks,
      deferredTasks,
      plannedMinutes,
      availableMinutes,
      capacity,
      doneCount,
      progress,
    ]
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): Ctx {
  const ctx = useContext(PlanContext);
  if (!ctx) {
    throw new Error('usePlan must be used inside <PlanProvider>');
  }
  return ctx;
}
