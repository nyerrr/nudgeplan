export type ThemeMode = 'auto' | 'light' | 'dark';
export type ThemeScheme = 'clean-mist';
export type ResolvedTheme = 'light' | 'dark';
export type Energy = 'low' | 'medium' | 'high';
export type Effort = 'low' | 'med' | 'high';
export type Day = 'today' | 'tomorrow';
export type TaskKind = 'task' | 'event' | 'reminder';
export type CheckInIntent = 'plan' | 'chat' | 'clarify' | 'act';
export type PlanActionType = 'move' | 'complete' | 'delete' | 'resize' | 'merge';
export type Screen =
  | 'home'
  | 'plan'
  | 'checkin'
  | 'focus'
  | 'insights'
  | 'profile'
  | 'subscription'
  | 'checkout'
  | 'payment'
  | 'privacy'
  | 'about';

export interface Step {
  id: string;
  text: string;
  min: number;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  dur: number;
  effort: Effort;
  day: Day;
  pri: 1 | 2 | 3;
  start: number | null;
  fixed: boolean;
  done: boolean;
  steps: Step[];
  /** ISO calendar deadline, when the task is tied to a real date. */
  dueDate: string | null;
  kind?: TaskKind;
  rationale?: string | null;
}

export interface ParsedStep {
  id?: string;
  text: string;
  min: number;
  done?: boolean;
}

export interface ParsedTask {
  id?: string;
  title: string;
  dur: number;
  effort: Effort;
  day: Day;
  pri: number;
  start: number | null;
  fixed: boolean;
  done?: boolean;
  stuck?: boolean;
  steps?: ParsedStep[];
  dueDate?: string | null;
  kind?: TaskKind;
  rationale?: string | null;
}

export interface ActionOut {
  type: PlanActionType;
  taskId: string;
  day?: Day | null;
  start?: number | null;
  dur?: number | null;
  targetTaskId?: string | null;
  title?: string | null;
  rationale?: string | null;
}

export interface ClarifyState {
  original_request: string;
  question: string;
}

export interface ParsedCheckIn {
  intent?: CheckInIntent;
  items: ParsedTask[];
  actions?: ActionOut[];
  energy: Energy | null;
  reply: string;
  capacity_warning?: string | null;
  clarify_state?: ClarifyState | null;
  source?: 'gemini' | 'offline';
}

export interface ProposalStep {
  key: string;
  text: string;
  minutesText: string;
}

export interface TaskProposal {
  key: string;
  title: string;
  durationText: string;
  effort: Effort;
  day: Day;
  priority: 1 | 2 | 3;
  startText: string;
  dueText: string;
  warnings: string[];
  source: ParsedTask | null;
  kind?: TaskKind;
  rationale?: string | null;
  steps: ProposalStep[];
}

export interface PendingCheckInReview {
  parsed: ParsedCheckIn;
  proposals: TaskProposal[];
}

export interface CheckInApiResponse extends ParsedCheckIn {
  model?: string | null;
}

export interface StepsApiResponse {
  steps: ParsedStep[];
  source?: 'gemini' | 'offline';
  model?: string | null;
}

export interface ChatCta {
  label: string;
  act: 'focus' | 'plan' | 'moveN' | 'checkin' | 'prompt';
  arg?: string;
  ghost?: boolean;
}

export interface ChatTaskLine {
  title: string;
  when: string;
}

export interface ChatMessage {
  id: string;
  from: 'bot' | 'me';
  text: string;
  intent?: CheckInIntent;
  tasks?: ChatTaskLine[];
  proposedTasks?: ParsedTask[];
  actions?: ActionOut[];
  source?: 'gemini' | 'offline';
  capacityWarning?: string | null;
  cta?: ChatCta[];
}

export interface HistoryEntry {
  id: string;
  when: string;
  text: string;
}

/** One day of real completion data, used by Insights. */
export interface DailyStat {
  date: string;
  done: number;
  total: number;
}

export interface AppState {
  v: 2;
  onboarded: boolean;
  name: string;
  startH: number;
  endH: number;
  energy: Energy;
  nudges: boolean;
  nudgeLeadMin: number;
  theme: ThemeMode;
  themeScheme: ThemeScheme;
  view: Day;
  focusId: string | null;
  chat: ChatMessage[];
  checkins: string[];
  history: HistoryEntry[];
  daily: DailyStat[];
  lastActiveDate: string;
  tasks: Task[];
}

export interface OnboardingProfile {
  name: string;
  startH: number;
  endH: number;
  energy: Energy;
  nudges: boolean;
}

export type AiStatus = 'checking' | 'online' | 'offline';

export interface TaskDraft {
  id: string | null;
  title: string;
  dur: number;
  effort: Effort;
  day: Day;
  pri: 1 | 2 | 3;
  start: number | null;
  dueDate: string | null;
}

export interface TimerState {
  stepId: string | null;
  secs: number;
  running: boolean;
  /** Epoch ms when the running timer ends; null while paused. */
  endsAt: number | null;
}

export interface ToastState {
  message: string;
  undo: boolean;
}
