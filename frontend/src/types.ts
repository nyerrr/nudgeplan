export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type Energy = 'low' | 'medium' | 'high';
export type Effort = 'low' | 'med' | 'high';
export type Day = 'today' | 'tomorrow';
export type Screen =
  | 'home'
  | 'plan'
  | 'checkin'
  | 'focus'
  | 'insights'
  | 'profile'
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
}

export interface ParsedCheckIn {
  items: ParsedTask[];
  energy: Energy | null;
  reply: string;
  source?: 'gemini' | 'offline';
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
  act: 'focus' | 'plan' | 'moveN' | 'checkin';
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
  tasks?: ChatTaskLine[];
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
